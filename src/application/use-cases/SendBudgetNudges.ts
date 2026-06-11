import { Bucket } from "@prisma/client";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentMonthRange,
  formatMoney,
  monthDayInfo,
  monthPeriodKey,
  pctSpent,
} from "./budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
// Savings overspend is good, not a leak — only nudge the spending buckets.
const WATCHED: Bucket[] = ["NEEDS", "WANTS"];
const WARN_THRESHOLD = 0.8;

export interface SendBudgetNudgesResult {
  sent: number;
}

// Proactively warns users before they blow a bucket (80%) and once they go over.
// Each nudge is sent at most once per bucket per month (idempotency via
// INudgeRepository), so a daily run does not spam. Build-brief step 9.
export class SendBudgetNudgesUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly nudgeRepository: INudgeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  async execute(): Promise<SendBudgetNudgesResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();
    const { start, end } = currentMonthRange();
    const periodKey = monthPeriodKey();
    const { day, daysInMonth } = monthDayInfo();
    const daysLeft = daysInMonth - day;

    let sent = 0;
    for (const user of users) {
      try {
        sent += await this.nudgeUser(user, start, end, periodKey, daysLeft);
      } catch (err) {
        // One user's failure must not abort the batch.
        console.error(`Nudge failed for user ${user.id}:`, err);
      }
    }
    return { sent };
  }

  private async nudgeUser(
    user: { id: string; telegramId: string | null; monthlyIncome: unknown },
    start: Date,
    end: Date,
    periodKey: string,
    daysLeft: number,
  ): Promise<number> {
    const income = Number(user.monthlyIncome ?? 0);
    if (income <= 0 || !user.telegramId) return 0;

    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;

    let sent = 0;
    for (const bucket of WATCHED) {
      const budget = bucketBudget(income, config, bucket);
      if (budget <= 0) continue;

      const spent = await this.expenseRepository.sumByBucketForMonth(
        user.id,
        bucket,
        start,
        end,
      );
      const meta = BUCKET_META[bucket];

      if (spent > budget) {
        const isNew = await this.nudgeRepository.recordSentIfNew(
          user.id,
          bucket,
          "OVER",
          periodKey,
        );
        if (isNew) {
          await this.send(
            user.telegramId,
            `🔴 You've gone over ${meta.label} by ${formatMoney(spent - budget)} this month.`,
          );
          sent++;
        }
      } else if (spent / budget >= WARN_THRESHOLD) {
        const isNew = await this.nudgeRepository.recordSentIfNew(
          user.id,
          bucket,
          "WARN_80",
          periodKey,
        );
        if (isNew) {
          await this.send(
            user.telegramId,
            `⚠️ Heads up — ${meta.label} at ${pctSpent(spent, budget)}% (${formatMoney(spent)} of ${formatMoney(budget)}) with ${daysLeft} days left.`,
          );
          sent++;
        }
      }
    }
    return sent;
  }

  private async send(telegramId: string, body: string): Promise<void> {
    await this.messageService.sendMessage({ to: telegramId, body });
  }
}
