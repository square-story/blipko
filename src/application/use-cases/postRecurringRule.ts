import { RecurringRule } from "@prisma/client";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { RunInTransaction } from "../../domain/repositories/UnitOfWork";
import { BUCKET_META, formatMoney, sanitizeMd } from "./budgetMath";

export interface PostRecurringRuleDeps {
  recurringRuleRepository: IRecurringRuleRepository;
  expenseRepository: IExpenseRepository;
  incomeRepository: IIncomeRepository;
  categoryRepository: ICategoryRepository;
  runTransaction: RunInTransaction;
}

// Creates the Expense/Income for one recurring rule and marks it posted for the
// given "YYYY-MM" key. Returns a short human summary (caller decides the wrapper
// copy). Shared by the daily cron (PostRecurringCharges) and the setup
// "add for this month" confirmation (RecurringConfirmProcessor).
//
// The post and the markPosted run in one transaction: a created charge that
// isn't marked posted would be re-posted (double-charged) on the next replay.
export async function postRecurringRule(
  deps: PostRecurringRuleDeps,
  rule: RecurringRule,
  monthKey: string,
): Promise<string> {
  const amount = Number(rule.amount);
  const rawText = `[recurring] ${rule.note ?? rule.kind.toLowerCase()}`;

  let summary: string;
  if (rule.kind === "INCOME") {
    await deps.runTransaction(async (tx) => {
      await deps.incomeRepository.create(
        {
          userId: rule.userId,
          amount,
          rawText,
          confidence: 1,
          source: rule.note ?? "recurring",
          note: rule.note ?? undefined,
        },
        tx,
      );
      await deps.recurringRuleRepository.markPosted(rule.id, monthKey, tx);
    });
    const label = rule.note ? ` (${sanitizeMd(rule.note)})` : "";
    summary = `income ${formatMoney(amount)}${label}`;
  } else {
    const bucket = rule.bucket ?? "NEEDS";
    // Read the category name up front; only the writes need to be atomic.
    const categoryName = rule.categoryId
      ? ((await deps.categoryRepository.findById(rule.categoryId))?.name ??
        null)
      : null;
    await deps.runTransaction(async (tx) => {
      await deps.expenseRepository.create(
        {
          userId: rule.userId,
          amount,
          bucket,
          note: rule.note ?? undefined,
          rawText,
          confidence: 1,
          categoryId: rule.categoryId ?? undefined,
        },
        tx,
      );
      await deps.recurringRuleRepository.markPosted(rule.id, monthKey, tx);
    });
    const where = categoryName ? ` · ${sanitizeMd(categoryName)}` : "";
    summary = `${formatMoney(amount)} → ${BUCKET_META[bucket].label}${where}${rule.note ? ` (${sanitizeMd(rule.note)})` : ""}`;
  }

  return summary;
}
