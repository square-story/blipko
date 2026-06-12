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
  sanitizeMd,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];
const LEAK_LIMIT = 3;

// Monthly summary on "report"/"/report": income, per-bucket spent vs budget with
// over/under deltas, and the biggest discretionary leaks (top Wants categories).
// Reports the current calendar month — budgets reset naturally each month since
// totals are scoped to currentMonthRange(). Build-brief step 10.
export class ReportProcessor implements MessageProcessor {
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
    return normalized === "report";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const { start, end } = currentBudgetPeriod(user.payday);
    const monthlyIncome = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      await this.incomeRepository.sumForMonth(user.id, start, end),
    );
    const monthName = new Intl.DateTimeFormat("en-IN", {
      month: "long",
    }).format(start);

    const lines: string[] = [];
    for (const bucket of ORDER) {
      const budget = bucketBudget(monthlyIncome, config, bucket);
      const spent = await this.expenseRepository.sumByBucketForMonth(
        user.id,
        bucket,
        start,
        end,
      );
      lines.push(this.bucketLine(bucket, spent, budget));
    }

    let body = `📅 ${monthName} summary\n\nIncome ${formatMoney(monthlyIncome)}\n${lines.join("\n")}`;

    const leaks = await this.expenseRepository.topCategoriesForMonth(
      user.id,
      "WANTS",
      start,
      end,
      LEAK_LIMIT,
    );
    const realLeaks = leaks.filter((l) => l.total > 0);
    if (realLeaks.length > 0) {
      const leakLines = realLeaks
        .map((l) => `  ${sanitizeMd(l.name)}  ${formatMoney(l.total)}`)
        .join("\n");
      body += `\n\nBiggest leaks in Wants:\n${leakLines}`;
    }

    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }

  private bucketLine(bucket: Bucket, spent: number, budget: number): string {
    const meta = BUCKET_META[bucket];
    const amounts = `${formatMoney(spent)} / ${formatMoney(budget)}`;
    let status: string;
    if (bucket === "SAVINGS") {
      status =
        spent >= budget && budget > 0
          ? "✅ goal hit"
          : `⚠️ short by ${formatMoney(budget - spent)}`;
    } else {
      const delta = budget - spent;
      status =
        delta >= 0
          ? `✅ under by ${formatMoney(delta)}`
          : `❌ over by ${formatMoney(-delta)}`;
    }
    return `${meta.emoji} ${meta.label}  ${amounts}  ${status}`;
  }
}
