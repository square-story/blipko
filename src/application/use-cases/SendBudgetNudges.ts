import { Bucket, NotificationDosage, RecurringRule } from "@prisma/client";
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
  formatMoney,
  periodDayInfo,
  periodKey,
  pctSpent,
  projectedRunOut,
  sanitizeMd,
} from "./budgetMath";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { zonedParts, zonedStartOfDayUtc, zonedYmd } from "../../utils/time";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
// Savings overspend is good, not a leak — only nudge the spending buckets.
const WATCHED: Bucket[] = ["NEEDS", "WANTS"];
// How often a dosage is allowed to speak, as local-time send windows. This is
// what "Reminder frequency" actually controls — one burst per window, so GENTLE
// gets one a day and RELENTLESS three.
//
// Windows are 4h wide and never overlap. Width, not a single hour, because the
// cron tick drifts by tens of minutes and is sometimes dropped outright; an
// exact-hour gate loses the whole day. Every nudge is ledger-deduped, so extra
// ticks inside one window cannot re-send.
const WINDOW_HOURS = 4;
const DAY_MS = 86_400_000;
// From this local hour the check-in asks about a day with nothing logged —
// earlier, an empty day is just a day that hasn't happened yet.
const QUIET_DAY_HOUR = 19;
const NUDGE_WINDOWS: Record<NotificationDosage, number[]> = {
  OFF: [],
  GENTLE: [19], //           19:00-22:59
  AGGRESSIVE: [13, 19], //   13:00-16:59, 19:00-22:59
  RELENTLESS: [9, 14, 19], // 09:00-12:59, 14:00-17:59, 19:00-22:59
};

// Subscriptions get forgotten "until the charge actually goes" — name the
// expense rules that post tomorrow. dayOfMonth is clamped to 1–28 at creation,
// so there is no month-end gap to handle.
export function chargesTomorrow(
  rules: Array<Pick<RecurringRule, "kind" | "dayOfMonth" | "amount" | "note">>,
  tomorrowDay: number,
): string | null {
  const due = rules.filter(
    (r) => r.kind === "EXPENSE" && r.dayOfMonth === tomorrowDay,
  );
  if (due.length === 0) return null;
  return `📅 Tomorrow: ${due
    .map(
      (r) =>
        `${sanitizeMd(r.note ?? "Recurring charge")} ${formatMoney(Number(r.amount))}`,
    )
    .join(" · ")}`;
}

// Which window this tick falls in, or null when the user should hear nothing.
function currentWindow(hour: number, starts: number[]): number | null {
  return starts.find((s) => hour >= s && hour < s + WINDOW_HOURS) ?? null;
}

export type NudgeSkipReason =
  | "noTelegram"
  | "dosageOff"
  | "outsideWindow"
  | "noIncome";

export interface SendBudgetNudgesResult {
  sent: number;
  considered: number;
  // Why the other users got nothing — without this, `sent: 0` is indistinguishable
  // from the job never running at all.
  skipped: Record<NudgeSkipReason, number>;
}

// Proactive reminders. notificationDosage picks both how many windows a day the
// user hears from (NUDGE_WINDOWS) and how often each kind may repeat:
//
//   kind      GENTLE   AGGRESSIVE   RELENTLESS
//   CHECKIN   slot     slot         slot          → once per window
//   WARN_80   cycle    day          day           → a hot bucket keeps nagging
//   WARN_50   —        cycle        cycle         → 50% is not "running hot"
//   OVER      cycle    day          slot
//
// Idempotency via INudgeRepository is what enforces all of it: the key scope IS
// the repeat rate, so several ticks inside one window collapse to one send.
export class SendBudgetNudgesUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly nudgeRepository: INudgeRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly recurringRuleRepository: IRecurringRuleRepository,
  ) {}

  // `now`/`force` come from the cron tick; `force` bypasses the local-hour gate.
  async execute(
    now: Date = new Date(),
    force = false,
  ): Promise<SendBudgetNudgesResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();

    let sent = 0;
    const skipped: Record<NudgeSkipReason, number> = {
      noTelegram: 0,
      dosageOff: 0,
      outsideWindow: 0,
      noIncome: 0,
    };
    for (const user of users) {
      try {
        const result = await this.nudgeUser(user, now, force);
        sent += result.sent;
        if (result.skip) skipped[result.skip]++;
      } catch (err) {
        // One user's failure must not abort the batch.
        console.error(`Nudge failed for user ${user.id}:`, err);
      }
    }
    return { sent, considered: users.length, skipped };
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
  ): Promise<{ sent: number; skip?: NudgeSkipReason }> {
    const dosage = user.notificationDosage;
    if (!user.telegramId) return { sent: 0, skip: "noTelegram" };
    if (dosage === "OFF") return { sent: 0, skip: "dosageOff" };

    // Send only inside one of this dosage's local windows (unless forced).
    const tz = user.timezone;
    const windows = NUDGE_WINDOWS[dosage];
    const window = currentWindow(zonedParts(now, tz).hour, windows);
    if (!force && window === null) return { sent: 0, skip: "outsideWindow" };
    // Forced runs have no real window; pin to the first so keys stay deterministic.
    const slotHour = window ?? windows[0];

    const loud = dosage === "AGGRESSIVE" || dosage === "RELENTLESS";

    // Per-user payday cycle, computed in the user's timezone.
    const { start, end } = currentBudgetPeriod(user.payday, now, tz);
    // Three dedupe scopes sharing one column. Prefixed because periodKey() returns
    // the cycle START DATE, the same YYYY-MM-DD shape as the day key — on a
    // payday-1 cycle the two would otherwise collide and swallow a nudge.
    const cycleKey = `c:${periodKey(user.payday, now, tz)}`;
    const dayKey = `d:${zonedYmd(now, tz)}`;
    const slotKey = `${dayKey}#${slotHour}`;
    const { day, daysInPeriod } = periodDayInfo(user.payday, now, tz);
    const daysLeft = daysInPeriod - day;

    const [earned, carried] = await Promise.all([
      this.incomeRepository.sumEarnedForMonth(user.id, start, end),
      this.incomeRepository.sumCarryForMonth(user.id, start, end),
    ]);
    const income = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      earned,
      carried,
    );
    if (income <= 0) return { sent: 0, skip: "noIncome" };

    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;

    let sent = 0;
    const summary: string[] = [];
    // The watched bucket that runs out first at its current pace, if any.
    let runOut: { label: string; day: number } | null = null;
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
      summary.push(`${meta.emoji} ${meta.label} ${pctSpent(spent, budget)}%`);
      const runOutDay = projectedRunOut(spent, budget, day, daysInPeriod);
      if (runOutDay !== null && (!runOut || runOutDay < runOut.day))
        runOut = { label: `${meta.emoji} ${meta.label}`, day: runOutDay };

      if (spent > budget) {
        // Over budget is the emergency: RELENTLESS re-raises it every window,
        // AGGRESSIVE every day, GENTLE once for the cycle.
        const overKey =
          dosage === "RELENTLESS" ? slotKey : loud ? dayKey : cycleKey;
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
            `🟠 ${meta.label} is ${formatMoney(spent - budget)} past this cycle's budget — the rest of the cycle can still balance it.`,
          );
          sent++;
        }
      } else if (spent / budget >= 0.8) {
        // "When a bucket runs hot" — daily for the loud levels. Cycle-keyed here
        // meant a bucket could sit at 88% all month after one alert.
        if (
          await this.nudgeRepository.recordSentIfNew(
            user.id,
            bucket,
            "WARN_80",
            loud ? dayKey : cycleKey,
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

    // Every dosage gets the check-in, once per window — this is the thing that
    // makes the levels differ in volume. GENTLE without it sent nothing at all
    // unless a bucket crossed 80%.
    if (summary.length > 0) {
      if (
        await this.nudgeRepository.recordSentIfNew(
          user.id,
          "NEEDS",
          "CHECKIN",
          slotKey,
        )
      ) {
        const lines = [
          `📊 Daily check-in — ${summary.join(" · ")} · ${daysLeft} days left.`,
        ];
        if (runOut) {
          // Noon of the run-out day, so a DST shift can't tip it into the
          // neighbouring date when formatted in the user's zone.
          const at = new Date(
            start.getTime() + (runOut.day - 1) * DAY_MS + DAY_MS / 2,
          );
          lines.push(
            `At this pace ${runOut.label} runs out around ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: tz }).format(at)}.`,
          );
        }
        const local = zonedParts(now, tz);
        if (local.hour >= QUIET_DAY_HOUR) {
          const today = await this.expenseRepository.findRecent(user.id, {
            limit: 1,
            from: zonedStartOfDayUtc(local.year, local.month, local.day, tz),
          });
          if (today.length === 0)
            lines.push(
              'Nothing logged today yet — small stuff adds up. Reply like "chai 20, auto 60".',
            );
        }
        const tomorrow = chargesTomorrow(
          await this.recurringRuleRepository.findByUserId(user.id),
          zonedParts(new Date(now.getTime() + DAY_MS), tz).day,
        );
        if (tomorrow) lines.push(tomorrow);
        await this.send(user.telegramId, lines.join("\n"));
        sent++;
      }
    }
    return { sent };
  }

  private async send(telegramId: string, body: string): Promise<void> {
    await this.messageService.sendMessage({ to: telegramId, body });
  }
}
