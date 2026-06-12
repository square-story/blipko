import { RecurringRule } from "@prisma/client";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { postRecurringRule } from "./postRecurringRule";

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
    const summary = await postRecurringRule(
      {
        recurringRuleRepository: this.recurringRuleRepository,
        expenseRepository: this.expenseRepository,
        incomeRepository: this.incomeRepository,
        categoryRepository: this.categoryRepository,
      },
      rule,
      monthKey,
    );

    const user = await this.userRepository.findById(rule.userId);
    if (user?.telegramId) {
      await this.messageService.sendMessage({
        to: user.telegramId,
        body: `📌 Auto-logged ${summary} — reply "undo" to remove.`,
      });
    }
  }
}
