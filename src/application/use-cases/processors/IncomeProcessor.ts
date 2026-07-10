import { Category } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { txnCb } from "../txnCallback";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const MAX_AMOUNT = 1_000_000_000;

// Records an income event (salary, freelance, bonus). General income refreshes
// this month's effective income + 50/30/20 budgets (budget grows as income
// lands, effectiveMonthlyIncome = max(expected, actual)). Income earmarked to a
// category is a two-way "pot" instead: it offsets that category's spend and is
// excluded from the general budget, so it replies with the fund balance.
export class IncomeProcessor implements MessageProcessor {
  constructor(
    private readonly incomeRepository: IIncomeRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "INCOME";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const { user, platformUserId, textMessage } = context;

    const amount = parsed.amount;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT
    ) {
      const response =
        'Hmm, I couldn\'t catch the income amount. Try something like "got salary 50000".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    // Earmark to a category when the parse names one that resolves to a leaf.
    // A group match (or unknown name) stays general — income never attaches to a
    // group, and we don't auto-create categories from income (no bucket to use).
    const matched = parsed.category
      ? await this.categoryRepository.findByNameForUser(
          user.id,
          parsed.category,
        )
      : null;
    const leaf = matched && !matched.isGroup ? matched : null;

    const income = await this.incomeRepository.create({
      userId: user.id,
      amount,
      rawText: textMessage,
      confidence: parsed.confidence,
      source: parsed.note,
      note: parsed.note,
      categoryId: leaf?.id,
    });

    const { start, end } = currentBudgetPeriod(user.payday);
    const response = leaf
      ? await this.fundResponse(user.id, leaf, amount, start, end)
      : await this.generalResponse(user, amount, parsed.note, start, end);

    // Send with quick-action buttons + store the message id so the user can
    // reply to (or tap) this confirmation to edit/delete the income later.
    const messageId = await this.messageService.sendInteractiveMessage(
      platformUserId,
      response,
      [
        [
          { id: txnCb.hintedit("income", income.id), title: "✏️ Edit" },
          { id: txnCb.askdel("income", income.id), title: "🗑 Delete" },
        ],
      ],
    );
    if (messageId) {
      await this.incomeRepository.updateConfirmationMessageId(
        income.id,
        messageId,
      );
    }
    return { response, parsed };
  }

  // Earmarked income: report the category "pot" balance (received − spent) this
  // cycle. Does NOT touch the 50/30/20 budget — earmarked money isn't general.
  private async fundResponse(
    userId: string,
    leaf: Category,
    amount: number,
    start: Date,
    end: Date,
  ): Promise<string> {
    const received =
      (
        await this.incomeRepository.receivedByCategoryForMonth(
          userId,
          start,
          end,
        )
      ).find((r) => r.categoryId === leaf.id)?.total ?? 0;
    const spent = await this.expenseRepository.sumByCategoryForMonth(
      userId,
      leaf.id,
      start,
      end,
    );
    const balance = received - spent;
    const balanceLine =
      balance >= 0
        ? `🟢 ${formatMoney(balance)} left in the pot`
        : `🔴 ${formatMoney(-balance)} over the pot`;
    const icon = leaf.icon ? `${leaf.icon} ` : "";
    return `✅ ${formatMoney(amount)} → ${icon}${sanitizeMd(leaf.name)} fund
📥 Received ${formatMoney(received)} · 💸 Spent ${formatMoney(spent)}
${balanceLine}`;
  }

  // General income: refresh the month's effective income + 50/30/20 budgets.
  // Budget sizes on general income only (sumForMonth); the display shows the
  // full amount received this cycle (sumTotalForMonth, incl. earmarked).
  private async generalResponse(
    user: ProcessContext["user"],
    amount: number,
    note: string | undefined,
    start: Date,
    end: Date,
  ): Promise<string> {
    const generalIncome = await this.incomeRepository.sumForMonth(
      user.id,
      start,
      end,
    );
    const totalIncome = await this.incomeRepository.sumTotalForMonth(
      user.id,
      start,
      end,
    );
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const expected = Number(user.monthlyIncome ?? 0);
    const effective = effectiveMonthlyIncome(expected, generalIncome);

    const label = note ? ` (${sanitizeMd(note)})` : "";
    return `✅ Income ${formatMoney(amount)}${label}
💵 Income this cycle: ${formatMoney(totalIncome)}
Budget on ${formatMoney(effective)} → ${BUCKET_META.NEEDS.emoji} Needs ${formatMoney(bucketBudget(effective, config, "NEEDS"))} · ${BUCKET_META.WANTS.emoji} Wants ${formatMoney(bucketBudget(effective, config, "WANTS"))} · ${BUCKET_META.SAVINGS.emoji} Savings ${formatMoney(bucketBudget(effective, config, "SAVINGS"))}`;
  }
}
