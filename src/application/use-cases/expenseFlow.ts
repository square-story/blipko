import { Bucket, Expense, ExpenseSource, User } from "@prisma/client";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "./budgetMath";

export interface ExpenseFlowDeps {
  expenseRepository: IExpenseRepository;
  categoryRepository: ICategoryRepository;
  budgetConfigRepository: IBudgetConfigRepository;
  incomeRepository: IIncomeRepository;
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
  batchId?: string | undefined;
}

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

// The confirmation line for a recorded expense (no budget context).
// Shared by the single-expense reply and each batch summary line.
export function buildExpenseLine(
  bucket: Bucket,
  categoryLabel: string,
  amount: number,
): string {
  const meta = BUCKET_META[bucket];
  return `✅ ${formatMoney(amount)} → ${meta.label} · ${sanitizeMd(categoryLabel)}`;
}

// Creates the expense and returns it plus the resolved category label. No
// messaging — callers decide how to reply (single confirmation vs batch summary).
export async function recordExpense(
  deps: ExpenseFlowDeps,
  args: RecordExpenseArgs,
): Promise<{ expense: Expense; categoryLabel: string }> {
  const { user, amount, bucket } = args;

  // Resolve the category: use a known id, else find-or-create by name + bucket.
  // Expenses only ever attach to leaf categories — never a group row. If the
  // name resolves to a group, the expense stays uncategorized (it still lands in
  // the right bucket and shows up in Needs Review). We can't create a same-name
  // leaf either: (userId, name) is unique.
  let categoryId = args.categoryId;
  let categoryLabel = args.categoryName ?? "General";
  if (!categoryId && args.categoryName) {
    const existing = await deps.categoryRepository.findByNameForUser(
      user.id,
      args.categoryName,
    );
    if (existing && !existing.isGroup) {
      categoryId = existing.id;
      categoryLabel = existing.name;
    } else if (!existing) {
      const created = await deps.categoryRepository.create({
        userId: user.id,
        name: args.categoryName,
        bucket,
      });
      categoryId = created.id;
      categoryLabel = created.name;
    }
    // else: name matches a group → leave uncategorized.
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
    batchId: args.batchId,
  });

  return { expense, categoryLabel };
}

// Creates the expense, sends the confirmation + remaining-budget line, and links
// the confirmation message for later reply/undo. Shared by ExpenseProcessor
// (high-confidence path) and ConfirmBucketProcessor (post-button path).
export async function recordExpenseAndReply(
  deps: ExpenseFlowDeps,
  args: RecordExpenseArgs,
): Promise<string> {
  const { user, amount, bucket } = args;

  const { expense, categoryLabel } = await recordExpense(deps, args);

  // Remaining budget for this bucket this month (sum already includes the new expense).
  const { start, end } = currentBudgetPeriod(user.payday);
  const spent = await deps.expenseRepository.sumByBucketForMonth(
    user.id,
    bucket,
    start,
    end,
  );
  const config =
    (await deps.budgetConfigRepository.findByUserId(user.id)) ?? DEFAULT_SPLIT;
  const monthIncome = await deps.incomeRepository.sumForMonth(
    user.id,
    start,
    end,
  );
  const income = effectiveMonthlyIncome(
    Number(user.monthlyIncome ?? 0),
    monthIncome,
  );
  const budget = bucketBudget(income, config, bucket);
  const remaining = budget - spent;

  const meta = BUCKET_META[bucket];
  const response = `${buildExpenseLine(bucket, categoryLabel, amount)}
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
