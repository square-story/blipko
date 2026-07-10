import { Bucket, NotificationDosage } from "@prisma/client";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  effectiveSpentByBucket,
  formatMoney,
  periodDayInfo,
  periodKey,
  pctSpent,
} from "./budgetMath";
import { zonedParts, zonedYmd } from "../../utils/time";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
// Savings overspend is good, not a leak — only nudge the spending buckets.
const WATCHED: Bucket[] = ["NEEDS", "WANTS"];
// Nudges go out at ~19:00 in each user's local timezone.
const NUDGE_HOUR = 19;

export interface SendBudgetNudgesResult {
  sent: number;
}

// Proactive reminders, gated by each user's notificationDosage:
//   OFF        → nothing.
//   GENTLE     → WARN_80 + OVER, once per bucket per cycle (the original behavior).
//   AGGRESSIVE → adds WARN_50 + a once-a-day CHECKIN summary.
//   RELENTLESS → as AGGRESSIVE, and OVER repeats daily until they're back under.
// Idempotency via INudgeRepository keeps a single daily run from spamming.
export class SendBudgetNudgesUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly nudgeRepository: INudgeRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  // `now`/`force` come from the cron tick; `force` bypasses the local-hour gate.
  async execute(
    now: Date = new Date(),
    force = false,
  ): Promise<SendBudgetNudgesResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();

    let sent = 0;
    for (const user of users) {
      try {
        sent += await this.nudgeUser(user, now, force);
      } catch (err) {
        // One user's failure must not abort the batch.
        console.error(`Nudge failed for user ${user.id}:`, err);
      }
    }
    return { sent };
  }

  private async nudgeUser(
    user: {
      id: string;
      telegramId: string | null;
      monthlyIncome: unknown;
      payday: number;
      timezone: string;
      notificationDosage: NotificationDosage;
    },
    now: Date,
    force: boolean,
  ): Promise<number> {
    const dosage = user.notificationDosage;
    if (!user.telegramId || dosage === "OFF") return 0;

    // Send only at the user's local evening hour (unless forced for testing).
    const tz = user.timezone;
    if (!force && zonedParts(now, tz).hour !== NUDGE_HOUR) return 0;

    const loud = dosage === "AGGRESSIVE" || dosage === "RELENTLESS";

    // Per-user payday cycle, computed in the user's timezone.
    const { start, end } = currentBudgetPeriod(user.payday, now, tz);
    const cycleKey = periodKey(user.payday, now, tz);
    const dayKey = zonedYmd(now, tz);
    const { day, daysInPeriod } = periodDayInfo(user.payday, now, tz);
    const daysLeft = daysInPeriod - day;

    const income = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      await this.incomeRepository.sumForMonth(user.id, start, end),
    );
    if (income <= 0) return 0;

    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;

    // Bucket spend net of earmarked income (envelope offset), fetched once.
    const effSpent = effectiveSpentByBucket(
      await this.expenseRepository.spendByCategoryForMonth(user.id, start, end),
      new Map(
        (
          await this.incomeRepository.receivedByCategoryForMonth(
            user.id,
            start,
            end,
          )
        ).map((r) => [r.categoryId, r.total]),
      ),
    );

    let sent = 0;
    const summary: string[] = [];
    for (const bucket of WATCHED) {
      const budget = bucketBudget(income, config, bucket);
      if (budget <= 0) continue;

      const spent = effSpent[bucket];
      const meta = BUCKET_META[bucket];
      summary.push(`${meta.emoji} ${meta.label} ${pctSpent(spent, budget)}%`);

      if (spent > budget) {
        // RELENTLESS repeats the over-budget alert daily; others once per cycle.
        const overKey = dosage === "RELENTLESS" ? dayKey : cycleKey;
        if (
          await this.nudgeRepository.recordSentIfNew(
            user.id,
            bucket,
            "OVER",
            overKey,
          )
        ) {
          await this.send(
            user.telegramId,
            `🔴 You've gone over ${meta.label} by ${formatMoney(spent - budget)} this cycle.`,
          );
          sent++;
        }
      } else if (spent / budget >= 0.8) {
        if (
          await this.nudgeRepository.recordSentIfNew(
            user.id,
            bucket,
            "WARN_80",
            cycleKey,
          )
        ) {
          await this.send(
            user.telegramId,
            `⚠️ Heads up — ${meta.label} at ${pctSpent(spent, budget)}% (${formatMoney(spent)} of ${formatMoney(budget)}) with ${daysLeft} days left.`,
          );
          sent++;
        }
      } else if (loud && spent / budget >= 0.5) {
        if (
          await this.nudgeRepository.recordSentIfNew(
            user.id,
            bucket,
            "WARN_50",
            cycleKey,
          )
        ) {
          await this.send(
            user.telegramId,
            `👀 ${meta.label} is halfway — ${pctSpent(spent, budget)}% used with ${daysLeft} days left.`,
          );
          sent++;
        }
      }
    }

    // Aggressive/Relentless also get a once-a-day check-in summary.
    if (loud && summary.length > 0) {
      if (
        await this.nudgeRepository.recordSentIfNew(
          user.id,
          "NEEDS",
          "CHECKIN",
          dayKey,
        )
      ) {
        await this.send(
          user.telegramId,
          `📊 Daily check-in — ${summary.join(" · ")} · ${daysLeft} days left.`,
        );
        sent++;
      }
    }
    return sent;
  }

  private async send(telegramId: string, body: string): Promise<void> {
    await this.messageService.sendMessage({ to: telegramId, body });
  }
}
