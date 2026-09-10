import { Bucket } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  incomeBasisLine,
  pctSpent,
  periodDayInfo,
  progressBar,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// Handles the budget-health check: plain "status"/"/status" (pre-AI) or the
// natural-language STATUS intent (post-AI). Shows per-bucket progress bars and
// the safe daily spend left for NEEDS/WANTS.
export class StatusProcessor implements MessageProcessor {
  constructor(
    private readonly expenseRepository: IExpenseRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    if (normalized === "status") return true;
    return context.parsed?.intent === "STATUS";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const { start, end } = currentBudgetPeriod(user.payday);
    const { day, daysInPeriod, remainingDays } = periodDayInfo(user.payday);
    // Gross is what landed; earned drives the budget. Showing only one of them
    // makes the other look wrong — "I got 69k, why is my budget 62k?"
    const [loggedIncome, earnedIncome] = await Promise.all([
      this.incomeRepository.sumForMonth(user.id, start, end),
      this.incomeRepository.sumEarnedForMonth(user.id, start, end),
    ]);
    const monthlyIncome = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      earnedIncome,
    );

    const lines: string[] = [];
    const dailyParts: string[] = [];

    for (const bucket of ORDER) {
      const budget = bucketBudget(monthlyIncome, config, bucket);
      const spent = await this.expenseRepository.sumByBucketForMonth(
        user.id,
        bucket,
        start,
        end,
      );
      const pct = pctSpent(spent, budget);
      const remaining = budget - spent;
      const meta = BUCKET_META[bucket];

      let suffix: string;
      if (bucket === "SAVINGS" && spent >= budget && budget > 0) {
        suffix = "✅";
      } else if (pct > 100) {
        suffix = `(${pct}%) 🔴`;
      } else {
        suffix = `(${pct}%)`;
      }

      lines.push(
        `${meta.emoji} ${meta.label}  ${progressBar(pct)}  ${formatMoney(spent)} / ${formatMoney(budget)}  ${suffix}`,
      );

      // Safe daily spend only for the spending buckets that still have room.
      if (bucket !== "SAVINGS" && remaining > 0) {
        const perDay = Math.floor(remaining / remainingDays);
        dailyParts.push(`${meta.label} ${formatMoney(perDay)}/day`);
      }
    }

    let body = `📊 This cycle — Day ${day} of ${daysInPeriod}\n💵 ${incomeBasisLine(loggedIncome, earnedIncome, monthlyIncome)}\n\n${lines.join("\n")}`;
    if (dailyParts.length > 0) {
      body += `\n\nSafe daily spend left:  ${dailyParts.join(" · ")}`;
    }

    await this.messageService.sendMessage({ to: platformUserId, body });
    // Stored as a marker, not the rendered income + per-bucket totals: this
    // is a pure projection the assistant can re-fetch, and the full text would
    // otherwise be replayed into the parser's prompt on every later message.
    return {
      response: body,
      parsed: { intent: "STATUS", confidence: 1 },
      historyText: "[showed budget status]",
    };
  }
}
