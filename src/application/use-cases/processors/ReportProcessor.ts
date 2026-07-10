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
  effectiveSpentByBucket,
  formatMoney,
  previousCycles,
  sanitizeMd,
} from "../budgetMath";
import { vsLastSuffix } from "../cycleReport";

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
    const prior = previousCycles(user.payday, 1)[0]!;
    // Budget sizes on general income; display shows all income received.
    const generalIncome = await this.incomeRepository.sumForMonth(
      user.id,
      start,
      end,
    );
    const totalIncome = await this.incomeRepository.sumTotalForMonth(
      user.id,
      start,
      end,
    );
    const monthlyIncome = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      generalIncome,
    );
    const monthName = new Intl.DateTimeFormat("en-IN", {
      month: "long",
    }).format(start);

    // Per-bucket spend, net of earmarked income, for the current + prior cycle.
    const [curRows, curRecv, prevRows, prevRecv] = await Promise.all([
      this.expenseRepository.spendByCategoryForMonth(user.id, start, end),
      this.incomeRepository.receivedByCategoryForMonth(user.id, start, end),
      this.expenseRepository.spendByCategoryForMonth(
        user.id,
        prior.start,
        prior.end,
      ),
      this.incomeRepository.receivedByCategoryForMonth(
        user.id,
        prior.start,
        prior.end,
      ),
    ]);
    const curEff = effectiveSpentByBucket(
      curRows,
      new Map(curRecv.map((r) => [r.categoryId, r.total])),
    );
    const prevEff = effectiveSpentByBucket(
      prevRows,
      new Map(prevRecv.map((r) => [r.categoryId, r.total])),
    );

    const lines: string[] = [];
    let totalSpent = 0;
    let totalPrev = 0;
    for (const bucket of ORDER) {
      const budget = bucketBudget(monthlyIncome, config, bucket);
      const spent = curEff[bucket];
      const prevSpent = prevEff[bucket];
      totalSpent += spent;
      totalPrev += prevSpent;
      lines.push(this.bucketLine(bucket, spent, budget, prevSpent));
    }

    let body = `📅 ${monthName} summary\n\nIncome logged ${formatMoney(totalIncome)} (budget on ${formatMoney(monthlyIncome)})\n${lines.join("\n")}`;

    const vs = vsLastSuffix(totalSpent, totalPrev);
    if (vs) body += `\n\nTotal spend ${formatMoney(totalSpent)}${vs}`;

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

  private bucketLine(
    bucket: Bucket,
    spent: number,
    budget: number,
    prevSpent: number,
  ): string {
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
    return `${meta.emoji} ${meta.label}  ${amounts}  ${status}${vsLastSuffix(spent, prevSpent)}`;
  }
}
