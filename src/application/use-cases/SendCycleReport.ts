import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../interfaces/IMessagingPlatform";
import { buildCycleReport } from "./cycleReport";
import { formatMoney, periodDayInfo, periodKey } from "./budgetMath";
import { inLocalHourWindow } from "../../utils/time";
import { carryCb } from "./carryCallback";

// The cycle report goes out in the 07:00-10:59 window of the user's local
// timezone, on day 1. A window and not a single hour because the cron tick
// drifts and is sometimes dropped; the CYCLE_REPORT ledger row keeps it to one
// send per ended cycle no matter how many ticks land inside the window.
const REPORT_HOUR = 7;
const REPORT_WINDOW_HOURS = 4;

export interface SendCycleReportResult {
  sent: number;
}

// On the first day of a fresh budget cycle (the user's payday), DM the
// just-ended cycle's summary + comparison to the prior cycle. Idempotent per
// ended cycle via the BudgetNudge ledger (kind CYCLE_REPORT), so a daily cron
// only sends once even if it runs every morning.
export class SendCycleReportUseCase {
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
  ): Promise<SendCycleReportResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();

    let sent = 0;
    for (const user of users) {
      try {
        sent += await this.reportUser(user, now, force);
      } catch (err) {
        // One user's failure must not abort the batch.
        console.error(`Cycle report failed for user ${user.id}:`, err);
      }
    }
    return { sent };
  }

  private async reportUser(
    user: {
      id: string;
      telegramId: string | null;
      monthlyIncome: unknown;
      payday: number;
      timezone: string;
      carryDecidedKey: string | null;
    },
    now: Date,
    force: boolean,
  ): Promise<number> {
    if (!user.telegramId) return 0;
    const tz = user.timezone;
    // Morning of day 1 in the user's timezone (unless forced for testing).
    if (!force && !inLocalHourWindow(now, tz, REPORT_HOUR, REPORT_WINDOW_HOURS))
      return 0;
    if (periodDayInfo(user.payday, now, tz).day !== 1) return 0;

    const { text, endedKey, cashLeftover } = await buildCycleReport(
      {
        expenseRepository: this.expenseRepository,
        budgetConfigRepository: this.budgetConfigRepository,
        incomeRepository: this.incomeRepository,
      },
      user,
      now,
      tz,
    );

    // The carry-forward question rides the report rather than arriving as its
    // own message: same day, same window, same ledger row. Nothing to ask when
    // the cycle left no cash over, or when the dashboard already settled it.
    //
    // cashLeftover, never the report's `net`: `net` is budget − spend and the
    // budget carries the expected-salary floor, so it would offer money the
    // user never received. A positive cashLeftover also implies income was
    // logged at all, so no separate "did anything happen" guard is needed.
    const cycleKey = periodKey(user.payday, now, tz);
    const carry =
      cashLeftover > 0 && user.carryDecidedKey !== cycleKey
        ? carryQuestion(cycleKey, Math.round(cashLeftover))
        : null;

    // NEEDS is a placeholder bucket — the ledger row is per-user-per-cycle.
    const isNew = await this.nudgeRepository.recordSentIfNew(
      user.id,
      "NEEDS",
      "CYCLE_REPORT",
      endedKey,
    );
    if (!isNew) return 0;

    if (!carry) {
      await this.messageService.sendMessage({
        to: user.telegramId,
        body: text,
      });
      return 1;
    }
    await this.messageService.sendInteractiveMessage(
      user.telegramId,
      `${text}\n\n${carry.body}`,
      carry.rows,
    );
    return 1;
  }
}

function carryQuestion(
  cycleKey: string,
  amount: number,
): { body: string; rows: InlineButtonRows } {
  const money = formatMoney(amount);
  return {
    // "landed and wasn't spent", not "is left over": the line above this is
    // "Net saved (budget − spend)", which is floored at the expected salary and
    // so can be a bigger number. Naming this one as cash stops the two from
    // looking like a contradiction.
    body:
      `💡 ${money} landed last cycle and wasn't spent. Where should it go?\n` +
      `Savings puts it away; opening balance adds it to this cycle's budget.`,
    rows: [
      [
        { id: carryCb.savings(cycleKey, amount), title: `💰 Savings ${money}` },
        {
          id: carryCb.opening(cycleKey, amount),
          title: `➡️ Opening balance ${money}`,
        },
      ],
      [
        { id: carryCb.other(cycleKey), title: "✏️ Different amount" },
        { id: carryCb.skip(cycleKey), title: "Skip" },
      ],
    ],
  };
}
