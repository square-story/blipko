import { RecurringRule, User } from "@prisma/client";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { RunInTransaction } from "../../domain/repositories/UnitOfWork";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { postRecurringRule } from "./postRecurringRule";
import { zonedParts } from "../../utils/time";

// Recurring rules auto-post at ~06:00 in the owner's local timezone.
const RECURRING_HOUR = 6;

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
    private readonly runTransaction: RunInTransaction,
  ) {}

  // Runs each active rule against its owner's local date/hour. `now` and `force`
  // come from the cron tick; `force` bypasses the local-hour gate for testing.
  async execute(
    now: Date = new Date(),
    force = false,
  ): Promise<PostRecurringChargesResult> {
    const rules = await this.recurringRuleRepository.findAllActive();
    const userCache = new Map<string, User | null>();

    let posted = 0;
    for (const rule of rules) {
      try {
        let user = userCache.get(rule.userId);
        if (user === undefined) {
          user = await this.userRepository.findById(rule.userId);
          userCache.set(rule.userId, user);
        }
        if (!user?.telegramId) continue;

        const { year, month, day, hour } = zonedParts(now, user.timezone);
        if (!force && hour !== RECURRING_HOUR) continue;

        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        if (rule.lastPostedKey === monthKey) continue; // already posted this month

        // Clamp e.g. day 31 → the month's last day; on-or-after so a missed day
        // still posts on the next run.
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const dueDay = Math.min(rule.dayOfMonth, daysInMonth);
        if (day < dueDay) continue;

        await this.post(rule, monthKey, user.telegramId);
        posted++;
      } catch (err) {
        // One rule's failure must not abort the batch.
        console.error(`Recurring post failed for rule ${rule.id}:`, err);
      }
    }
    return { posted };
  }

  private async post(
    rule: RecurringRule,
    monthKey: string,
    telegramId: string,
  ): Promise<void> {
    const summary = await postRecurringRule(
      {
        recurringRuleRepository: this.recurringRuleRepository,
        expenseRepository: this.expenseRepository,
        incomeRepository: this.incomeRepository,
        categoryRepository: this.categoryRepository,
        runTransaction: this.runTransaction,
      },
      rule,
      monthKey,
    );

    await this.messageService.sendMessage({
      to: telegramId,
      body: `📌 Auto-logged ${summary} — reply "undo" to remove.`,
    });
  }
}
