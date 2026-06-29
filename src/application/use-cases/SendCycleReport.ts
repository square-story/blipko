import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { buildCycleReport } from "./cycleReport";
import { periodDayInfo } from "./budgetMath";

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

  async execute(now: Date = new Date()): Promise<SendCycleReportResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();

    let sent = 0;
    for (const user of users) {
      try {
        sent += await this.reportUser(user, now);
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
    },
    now: Date,
  ): Promise<number> {
    if (!user.telegramId) return 0;
    // Only on the day the cycle just rolled over.
    if (periodDayInfo(user.payday, now).day !== 1) return 0;

    const { text, endedKey } = await buildCycleReport(
      {
        expenseRepository: this.expenseRepository,
        budgetConfigRepository: this.budgetConfigRepository,
        incomeRepository: this.incomeRepository,
      },
      user,
      now,
    );

    // NEEDS is a placeholder bucket — the ledger row is per-user-per-cycle.
    const isNew = await this.nudgeRepository.recordSentIfNew(
      user.id,
      "NEEDS",
      "CYCLE_REPORT",
      endedKey,
    );
    if (!isNew) return 0;

    await this.messageService.sendMessage({ to: user.telegramId, body: text });
    return 1;
  }
}
