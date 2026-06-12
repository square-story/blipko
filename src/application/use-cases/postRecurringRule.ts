import { RecurringRule } from "@prisma/client";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { BUCKET_META, formatMoney, sanitizeMd } from "./budgetMath";

export interface PostRecurringRuleDeps {
  recurringRuleRepository: IRecurringRuleRepository;
  expenseRepository: IExpenseRepository;
  incomeRepository: IIncomeRepository;
  categoryRepository: ICategoryRepository;
}

// Creates the Expense/Income for one recurring rule and marks it posted for the
// given "YYYY-MM" key. Returns a short human summary (caller decides the wrapper
// copy). Shared by the daily cron (PostRecurringCharges) and the setup
// "add for this month" confirmation (RecurringConfirmProcessor).
export async function postRecurringRule(
  deps: PostRecurringRuleDeps,
  rule: RecurringRule,
  monthKey: string,
): Promise<string> {
  const amount = Number(rule.amount);
  const rawText = `[recurring] ${rule.note ?? rule.kind.toLowerCase()}`;

  let summary: string;
  if (rule.kind === "INCOME") {
    await deps.incomeRepository.create({
      userId: rule.userId,
      amount,
      rawText,
      confidence: 1,
      source: rule.note ?? "recurring",
      note: rule.note ?? undefined,
    });
    const label = rule.note ? ` (${sanitizeMd(rule.note)})` : "";
    summary = `income ${formatMoney(amount)}${label}`;
  } else {
    const bucket = rule.bucket ?? "NEEDS";
    await deps.expenseRepository.create({
      userId: rule.userId,
      amount,
      bucket,
      note: rule.note ?? undefined,
      rawText,
      confidence: 1,
      categoryId: rule.categoryId ?? undefined,
    });
    const categoryName = rule.categoryId
      ? ((await deps.categoryRepository.findById(rule.categoryId))?.name ??
        null)
      : null;
    const where = categoryName ? ` · ${sanitizeMd(categoryName)}` : "";
    summary = `${formatMoney(amount)} → ${BUCKET_META[bucket].label}${where}${rule.note ? ` (${sanitizeMd(rule.note)})` : ""}`;
  }

  // Mark posted before any notify — a duplicate post is worse than a missed DM.
  await deps.recurringRuleRepository.markPosted(rule.id, monthKey);
  return summary;
}
