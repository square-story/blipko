import { randomUUID } from "node:crypto";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IParseLogRepository } from "../../../domain/repositories/IParseLogRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import {
  recordExpense,
  buildExpenseLine,
  buildBucketBudgetLine,
} from "../expenseFlow";
import { txnCb } from "../txnCallback";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  effectiveSpentByBucket,
  formatMoney,
  periodDayInfo,
  sanitizeMd,
} from "../budgetMath";

const CONFIDENCE_THRESHOLD = 0.6;
const EXPENSE_MAX = 10_000_000;
const INCOME_MAX = 1_000_000_000;
// Bounds latency and Telegram's 8-row keyboard limit for the follow-up.
const MAX_ITEMS = 12;
const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

function isValidAmount(
  amount: number | undefined,
  max: number,
): amount is number {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= max
  );
}

// Handles a message that parsed into MULTIPLE transactions (a journal dump).
// Records high-confidence EXPENSE/INCOME items immediately under one shared
// batchId, sends ONE summary, and asks about ambiguous items in ONE grouped
// follow-up (reusing the bkt: callback → ConfirmBucketProcessor is untouched).
// A plain "undo" later removes the whole batch (see UndoProcessor).
export class BatchProcessor implements MessageProcessor {
  constructor(
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly parseLogRepository: IParseLogRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return (context.parsedBatch?.transactions.length ?? 0) >= 2;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage } = context;
    const batchId = randomUUID();
    const all = context.parsedBatch!.transactions;
    const items = all.slice(0, MAX_ITEMS);
    const dropped = all.length - items.length;

    const logged: string[] = [];
    const ambiguous: {
      parseLogId: string;
      amount: number;
      note?: string | undefined;
    }[] = [];
    let firstExpenseId: string | undefined;
    // Only GENERAL (uncategorized) income moves the 50/30/20 budget — earmarked
    // income is a category pot and doesn't touch it.
    let recordedGeneralIncome = false;

    const deps = {
      expenseRepository: this.expenseRepository,
      categoryRepository: this.categoryRepository,
      budgetConfigRepository: this.budgetConfigRepository,
      incomeRepository: this.incomeRepository,
      messageService: this.messageService,
    };

    // Budget context for the per-item bucket sub-line (computed once; income
    // logged mid-batch isn't reflected in later items' budget — acceptable).
    const { start: periodStart, end: periodEnd } = currentBudgetPeriod(
      user.payday,
    );
    const { remainingDays } = periodDayInfo(user.payday);
    const splitConfig =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const batchIncome = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      await this.incomeRepository.sumForMonth(user.id, periodStart, periodEnd),
    );
    // Earmarked income per category (computed once; income logged mid-batch
    // isn't reflected in later items' offset — acceptable for the terse hint).
    const receivedByCategory = new Map(
      (
        await this.incomeRepository.receivedByCategoryForMonth(
          user.id,
          periodStart,
          periodEnd,
        )
      ).map((r) => [r.categoryId, r.total]),
    );

    for (const item of items) {
      // Batch mode only logs money; skip stray non-EXPENSE/INCOME items.
      if (item.intent === "INCOME") {
        if (!isValidAmount(item.amount, INCOME_MAX)) continue;
        // Earmark to a leaf category when named; group/unknown stays general.
        const incMatched = item.category
          ? await this.categoryRepository.findByNameForUser(
              user.id,
              item.category,
            )
          : null;
        const incLeaf = incMatched && !incMatched.isGroup ? incMatched : null;
        await this.incomeRepository.create({
          userId: user.id,
          amount: item.amount,
          rawText: textMessage,
          confidence: item.confidence,
          source: item.note,
          note: item.note,
          batchId,
          categoryId: incLeaf?.id,
        });
        if (incLeaf) {
          const icon = incLeaf.icon ? `${incLeaf.icon} ` : "";
          logged.push(
            `✅ ${formatMoney(item.amount)} → ${icon}${sanitizeMd(incLeaf.name)} fund`,
          );
        } else {
          recordedGeneralIncome = true;
          const label = item.note ? ` (${sanitizeMd(item.note)})` : "";
          logged.push(`✅ Income ${formatMoney(item.amount)}${label}`);
        }
        continue;
      }
      if (item.intent !== "EXPENSE") continue;
      if (!isValidAmount(item.amount, EXPENSE_MAX)) continue;

      const matched = item.category
        ? await this.categoryRepository.findByNameForUser(
            user.id,
            item.category,
          )
        : null;
      const leaf = matched && !matched.isGroup ? matched : null;
      const bucket = matched?.bucket ?? item.bucket;

      if (item.confidence < CONFIDENCE_THRESHOLD || !bucket) {
        const log = await this.parseLogRepository.create({
          rawText: textMessage,
          parsed: item,
          confidence: item.confidence,
          userId: user.id,
          batchId,
        });
        ambiguous.push({
          parseLogId: log.id,
          amount: item.amount,
          note: item.note,
        });
        continue;
      }

      const { expense, categoryLabel } = await recordExpense(deps, {
        user,
        platformUserId,
        amount: item.amount,
        bucket,
        rawText: textMessage,
        confidence: item.confidence,
        note: item.note,
        categoryId: leaf?.id,
        categoryName: leaf?.name ?? item.category,
        batchId,
      });
      firstExpenseId ??= expense.id;
      const bucketSpent = effectiveSpentByBucket(
        await this.expenseRepository.spendByCategoryForMonth(
          user.id,
          periodStart,
          periodEnd,
        ),
        receivedByCategory,
      )[bucket];
      const bucketBudgetAmt = bucketBudget(batchIncome, splitConfig, bucket);
      logged.push(
        buildExpenseLine(bucket, categoryLabel, item.amount) +
          "\n" +
          buildBucketBudgetLine(
            bucket,
            bucketBudgetAmt - bucketSpent,
            bucketBudgetAmt,
            remainingDays,
            { compact: true },
          ),
      );
    }

    // Recompute the effective budget once if any general income landed.
    let budgetLine = "";
    if (recordedGeneralIncome) {
      const { start, end } = currentBudgetPeriod(user.payday);
      const monthIncome = await this.incomeRepository.sumForMonth(
        user.id,
        start,
        end,
      );
      const config =
        (await this.budgetConfigRepository.findByUserId(user.id)) ??
        DEFAULT_SPLIT;
      const effective = effectiveMonthlyIncome(
        Number(user.monthlyIncome ?? 0),
        monthIncome,
      );
      budgetLine = `Budget on ${formatMoney(effective)} → ${BUCKET_META.NEEDS.emoji} Needs ${formatMoney(bucketBudget(effective, config, "NEEDS"))} · ${BUCKET_META.WANTS.emoji} Wants ${formatMoney(bucketBudget(effective, config, "WANTS"))} · ${BUCKET_META.SAVINGS.emoji} Savings ${formatMoney(bucketBudget(effective, config, "SAVINGS"))}`;
    }

    const parts: string[] = [];
    if (logged.length) parts.push(logged.join("\n"));
    if (budgetLine) parts.push(budgetLine);
    if (dropped > 0) {
      parts.push(
        `(Logged the first ${MAX_ITEMS} — send the other ${dropped} separately.)`,
      );
    }
    const summaryBody =
      parts.join("\n") ||
      'Hmm, I couldn\'t catch those. Try "chai 30, auto 80".';

    // Delete-all button when anything was logged (confirm-gated on tap).
    const summaryRows: InlineButtonRows = firstExpenseId
      ? [[{ id: txnCb.askdelbatch(batchId), title: "🗑 Delete all" }]]
      : [];
    const summaryMsgId = await this.messageService.sendInteractiveMessage(
      platformUserId,
      summaryBody,
      summaryRows,
    );
    // Link one representative row to the summary so replying to it undoes the
    // whole batch (batchId does the grouping — see UndoProcessor).
    if (summaryMsgId && firstExpenseId) {
      await this.expenseRepository.updateConfirmationMessageId(
        firstExpenseId,
        summaryMsgId,
      );
    }

    if (ambiguous.length) {
      const followupBody =
        "Which bucket for these?\n" +
        ambiguous
          .map(
            (a) =>
              `• ${formatMoney(a.amount)}${a.note ? ` (${sanitizeMd(a.note)})` : ""}`,
          )
          .join("\n");
      const rows: InlineButtonRows = ambiguous.map((a) => [
        {
          id: `bkt:${a.parseLogId}:NEEDS`,
          title: `🏠 ${formatMoney(a.amount)} Need`,
        },
        {
          id: `bkt:${a.parseLogId}:WANTS`,
          title: `🎯 ${formatMoney(a.amount)} Want`,
        },
        {
          id: `bkt:${a.parseLogId}:SAVINGS`,
          title: `💰 ${formatMoney(a.amount)} Save`,
        },
      ]);
      await this.messageService.sendInteractiveMessage(
        platformUserId,
        followupBody,
        rows,
      );
    }

    return {
      response: summaryBody,
      parsed: { intent: "EXPENSE", confidence: 1 },
    };
  }
}
