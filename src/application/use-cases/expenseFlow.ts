import { Bucket, ExpenseSource, User } from "@prisma/client";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentMonthRange,
  formatMoney,
  sanitizeMd,
} from "./budgetMath";

export interface ExpenseFlowDeps {
  expenseRepository: IExpenseRepository;
  categoryRepository: ICategoryRepository;
  budgetConfigRepository: IBudgetConfigRepository;
  messageService: IMessagingPlatform;
}

export interface RecordExpenseArgs {
  user: User;
  platformUserId: string;
  amount: number;
  bucket: Bucket;
  rawText: string;
  confidence: number;
  note?: string | undefined;
  categoryName?: string | undefined;
  categoryId?: string | undefined;
  source?: ExpenseSource | undefined;
  parseLogId?: string | undefined;
}

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

// Creates the expense, sends the confirmation + remaining-budget line, and links
// the confirmation message for later reply/undo. Shared by ExpenseProcessor
// (high-confidence path) and ConfirmBucketProcessor (post-button path).
export async function recordExpenseAndReply(
  deps: ExpenseFlowDeps,
  args: RecordExpenseArgs,
): Promise<string> {
  const { user, amount, bucket } = args;

  // Resolve the category: use a known id, else find-or-create by name + bucket.
  let categoryId = args.categoryId;
  let categoryLabel = args.categoryName ?? "General";
  if (!categoryId && args.categoryName) {
    const existing = await deps.categoryRepository.findByNameForUser(
      user.id,
      args.categoryName,
    );
    if (existing) {
      categoryId = existing.id;
      categoryLabel = existing.name;
    } else {
      const created = await deps.categoryRepository.create({
        userId: user.id,
        name: args.categoryName,
        bucket,
      });
      categoryId = created.id;
      categoryLabel = created.name;
    }
  }

  const expense = await deps.expenseRepository.create({
    userId: user.id,
    amount,
    bucket,
    note: args.note,
    rawText: args.rawText,
    confidence: args.confidence,
    source: args.source,
    categoryId,
    parseLogId: args.parseLogId,
  });

  // Remaining budget for this bucket this month (sum already includes the new expense).
  const { start, end } = currentMonthRange();
  const spent = await deps.expenseRepository.sumByBucketForMonth(
    user.id,
    bucket,
    start,
    end,
  );
  const config =
    (await deps.budgetConfigRepository.findByUserId(user.id)) ?? DEFAULT_SPLIT;
  const monthlyIncome = Number(user.monthlyIncome ?? 0);
  const budget = bucketBudget(monthlyIncome, config, bucket);
  const remaining = budget - spent;

  const meta = BUCKET_META[bucket];
  const response = `✅ ${formatMoney(amount)} → ${meta.label} · ${sanitizeMd(categoryLabel)}
${meta.emoji} ${meta.label} left this month: ${formatMoney(remaining)} / ${formatMoney(budget)}`;

  const messageId = await deps.messageService.sendMessage({
    to: args.platformUserId,
    body: response,
  });
  if (messageId) {
    await deps.expenseRepository.updateConfirmationMessageId(
      expense.id,
      messageId,
    );
  }

  return response;
}
