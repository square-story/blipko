import { Bucket, Expense, Income } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

// The entry an undo anchors on, tagged by table so we know how to delete it.
type AnchorEntry =
  | { kind: "expense"; row: Expense; batchId: string | null }
  | { kind: "income"; row: Income; batchId: string | null };

// Removes an expense and restores the budget. Targets the replied-to expense
// when the user replies to its confirmation, otherwise the most recent one.
// Triggers on plain "undo"/"/undo" (pre-AI) or the UNDO intent (post-AI).
export class UndoProcessor implements MessageProcessor {
  constructor(
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    if (normalized === "undo") return true;
    return context.parsed?.intent === "UNDO";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, replyToMessageId } = context;

    // Resolve what to undo. A replied-to confirmation targets that expense;
    // otherwise the most recent entry across expenses and income.
    const repliedExpense = replyToMessageId
      ? await this.expenseRepository.findByConfirmationMessageId(
          replyToMessageId,
          user.id,
        )
      : null;

    const anchor: AnchorEntry | null = repliedExpense
      ? {
          kind: "expense",
          row: repliedExpense,
          batchId: repliedExpense.batchId,
        }
      : await this.pickLatestEntry(user.id);

    if (!anchor) {
      return this.reply(
        platformUserId,
        "Nothing to undo yet — log a spend first.",
      );
    }

    // A batchId means this entry came from a multi-transaction message: undo
    // the whole batch. Otherwise remove just the one entry (today's behavior).
    if (anchor.batchId) {
      return this.undoBatch(context, anchor.batchId);
    }
    return anchor.kind === "expense"
      ? this.undoSingleExpense(context, anchor.row)
      : this.undoSingleIncome(context, anchor.row);
  }

  // The most recent non-deleted entry across expenses + income, tagged by kind.
  private async pickLatestEntry(userId: string): Promise<AnchorEntry | null> {
    const expense = await this.expenseRepository.findLastByUserId(userId);
    const income = await this.incomeRepository.findLastByUserId(userId);
    if (!expense && !income) return null;
    if (expense && (!income || expense.date >= income.date)) {
      return { kind: "expense", row: expense, batchId: expense.batchId };
    }
    return { kind: "income", row: income!, batchId: income!.batchId };
  }

  private async undoSingleExpense(
    context: ProcessContext,
    target: Expense,
  ): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    await this.expenseRepository.softDelete(target.id);

    const remaining = await this.bucketRemaining(user, target.bucket);
    const label = await this.describe(target.categoryId, target.note);
    const meta = BUCKET_META[target.bucket];
    const body = `↩️ Removed: ${formatMoney(Number(target.amount))} ${label}. ${meta.label} left this month: ${formatMoney(remaining)}.`;
    return this.reply(platformUserId, body);
  }

  private async undoSingleIncome(
    context: ProcessContext,
    target: Income,
  ): Promise<ProcessOutput> {
    const { platformUserId } = context;
    await this.incomeRepository.softDelete(target.id);
    const label = target.note ? ` (${sanitizeMd(target.note)})` : "";
    const body = `↩️ Removed income: ${formatMoney(Number(target.amount))}${label}.`;
    return this.reply(platformUserId, body);
  }

  private async undoBatch(
    context: ProcessContext,
    batchId: string,
  ): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const expenses = await this.expenseRepository.findByBatchId(
      batchId,
      user.id,
    );
    const incomes = await this.incomeRepository.findByBatchId(batchId, user.id);

    await this.expenseRepository.softDeleteByBatchId(batchId, user.id);
    await this.incomeRepository.softDeleteByBatchId(batchId, user.id);

    const count = expenses.length + incomes.length;
    const total =
      expenses.reduce((s, e) => s + Number(e.amount), 0) +
      incomes.reduce((s, i) => s + Number(i.amount), 0);

    const lines: string[] = [
      `↩️ Removed ${count} ${count === 1 ? "entry" : "entries"} (${formatMoney(total)} total).`,
    ];

    // Refresh each affected bucket's remaining budget.
    const buckets = [...new Set(expenses.map((e) => e.bucket))];
    for (const bucket of buckets) {
      const remaining = await this.bucketRemaining(user, bucket);
      const meta = BUCKET_META[bucket];
      lines.push(
        `${meta.emoji} ${meta.label} left this month: ${formatMoney(remaining)}.`,
      );
    }

    return this.reply(platformUserId, lines.join("\n"));
  }

  // Remaining budget for a bucket this cycle (sum already excludes deleted rows).
  private async bucketRemaining(
    user: ProcessContext["user"],
    bucket: Bucket,
  ): Promise<number> {
    const { start, end } = currentBudgetPeriod(user.payday);
    const spent = await this.expenseRepository.sumByBucketForMonth(
      user.id,
      bucket,
      start,
      end,
    );
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const income = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      await this.incomeRepository.sumForMonth(user.id, start, end),
    );
    return bucketBudget(income, config, bucket) - spent;
  }

  private async describe(
    categoryId: string | null,
    note: string | null,
  ): Promise<string> {
    if (categoryId) {
      const category = await this.categoryRepository.findById(categoryId);
      if (category) return sanitizeMd(category.name);
    }
    return note ? sanitizeMd(note) : "expense";
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "UNDO", confidence: 1 } };
  }
}
