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
  currentMonthRange,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

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

    const target = replyToMessageId
      ? ((await this.expenseRepository.findByConfirmationMessageId(
          replyToMessageId,
          user.id,
        )) ?? (await this.expenseRepository.findLastByUserId(user.id)))
      : await this.expenseRepository.findLastByUserId(user.id);

    if (!target) {
      return this.reply(
        platformUserId,
        "Nothing to undo yet — log a spend first.",
      );
    }

    await this.expenseRepository.softDelete(target.id);

    // Budget auto-corrects: sumByBucketForMonth excludes deleted expenses.
    const { start, end } = currentMonthRange();
    const spent = await this.expenseRepository.sumByBucketForMonth(
      user.id,
      target.bucket,
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
    const budget = bucketBudget(income, config, target.bucket);
    const remaining = budget - spent;

    const label = await this.describe(target.categoryId, target.note);
    const meta = BUCKET_META[target.bucket];
    const body = `↩️ Removed: ${formatMoney(Number(target.amount))} ${label}. ${meta.label} left this month: ${formatMoney(remaining)}.`;

    return this.reply(platformUserId, body);
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
