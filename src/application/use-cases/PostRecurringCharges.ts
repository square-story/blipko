import { RecurringRule } from "@prisma/client";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { BUCKET_META, formatMoney, sanitizeMd } from "./budgetMath";

export interface PostRecurringChargesResult {
  posted: number;
}

// Daily job: auto-posts each active recurring rule once per calendar month, on
// or after its dayOfMonth, and DMs the user. Idempotent via lastPostedKey
// ("YYYY-MM"); posting is monthly-on-dayOfMonth (independent of the payday cycle).
export class PostRecurringChargesUseCase {
  constructor(
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly userRepository: IUserRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  async execute(now: Date = new Date()): Promise<PostRecurringChargesResult> {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const today = now.getDate();

    const rules =
      await this.recurringRuleRepository.findActiveUnpostedForMonth(monthKey);

    let posted = 0;
    for (const rule of rules) {
      const dueDay = Math.min(rule.dayOfMonth, daysInMonth);
      if (today < dueDay) continue;
      try {
        await this.post(rule, monthKey);
        posted++;
      } catch (err) {
        // One rule's failure must not abort the batch.
        console.error(`Recurring post failed for rule ${rule.id}:`, err);
      }
    }
    return { posted };
  }

  private async post(rule: RecurringRule, monthKey: string): Promise<void> {
    const amount = Number(rule.amount);
    const rawText = `[recurring] ${rule.note ?? rule.kind.toLowerCase()}`;

    let body: string;
    if (rule.kind === "INCOME") {
      await this.incomeRepository.create({
        userId: rule.userId,
        amount,
        rawText,
        confidence: 1,
        source: rule.note ?? "recurring",
        note: rule.note ?? undefined,
      });
      const label = rule.note ? ` (${sanitizeMd(rule.note)})` : "";
      body = `📌 Auto-logged income ${formatMoney(amount)}${label} — reply "undo" to remove.`;
    } else {
      const bucket = rule.bucket ?? "NEEDS";
      await this.expenseRepository.create({
        userId: rule.userId,
        amount,
        bucket,
        note: rule.note ?? undefined,
        rawText,
        confidence: 1,
        categoryId: rule.categoryId ?? undefined,
      });
      const categoryName = rule.categoryId
        ? ((await this.categoryRepository.findById(rule.categoryId))?.name ??
          null)
        : null;
      const where = categoryName ? ` · ${sanitizeMd(categoryName)}` : "";
      body = `📌 Auto-logged ${formatMoney(amount)} → ${BUCKET_META[bucket].label}${where}${rule.note ? ` (${sanitizeMd(rule.note)})` : ""} — reply "undo" to remove.`;
    }

    // Record idempotency before notifying (a duplicate is worse than a missed DM).
    await this.recurringRuleRepository.markPosted(rule.id, monthKey);

    const user = await this.userRepository.findById(rule.userId);
    if (user?.telegramId) {
      await this.messageService.sendMessage({ to: user.telegramId, body });
    }
  }
}
