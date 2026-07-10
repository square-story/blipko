import { Bucket } from "@prisma/client";
import {
  DateRange,
  IFinancialDataTools,
  PeriodStatus,
  CategoryTotal,
  RecentExpense,
  RecurringRuleSummary,
} from "../../../domain/services/IFinancialDataTools";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import {
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  effectiveSpentByBucket,
  pctSpent,
  periodDayInfo,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// Read-only data tools for the conversational query agent. Reuses the same
// repositories + budgetMath as the deterministic processors, so answers match
// what /status and /report would show. No method ever writes.
export class FinancialDataTools implements IFinancialDataTools {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async getPeriodStatus(userId: string): Promise<PeriodStatus> {
    const user = await this.requireUser(userId);
    const config =
      (await this.budgetConfigRepository.findByUserId(userId)) ?? DEFAULT_SPLIT;
    const { start, end } = currentBudgetPeriod(user.payday);
    const { day, daysInPeriod, remainingDays } = periodDayInfo(user.payday);
    // Budget sizes on general income; incomeLogged reports all income received.
    const generalIncome = await this.incomeRepository.sumForMonth(
      userId,
      start,
      end,
    );
    const incomeLogged = await this.incomeRepository.sumTotalForMonth(
      userId,
      start,
      end,
    );
    const monthlyIncome = effectiveMonthlyIncome(
      Number(user.monthlyIncome ?? 0),
      generalIncome,
    );

    const effSpent = effectiveSpentByBucket(
      await this.expenseRepository.spendByCategoryForMonth(userId, start, end),
      new Map(
        (
          await this.incomeRepository.receivedByCategoryForMonth(
            userId,
            start,
            end,
          )
        ).map((r) => [r.categoryId, r.total]),
      ),
    );

    const buckets = ORDER.map((bucket) => {
      const budget = bucketBudget(monthlyIncome, config, bucket);
      const spent = effSpent[bucket];
      return {
        bucket,
        budget,
        spent,
        remaining: budget - spent,
        pct: pctSpent(spent, budget),
      };
    });

    return {
      currency: user.currency,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      day,
      daysInPeriod,
      remainingDays,
      monthlyIncome,
      incomeLogged,
      buckets,
    };
  }

  async getSpendByBucket(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
  ): Promise<Array<{ bucket: Bucket; total: number }>> {
    const { from, to } = await this.resolveRange(userId, range);
    const buckets = bucket ? [bucket] : ORDER;
    return Promise.all(
      buckets.map(async (b) => ({
        bucket: b,
        total: await this.expenseRepository.sumByBucketForMonth(
          userId,
          b,
          from,
          to,
        ),
      })),
    );
  }

  async getSpendByCategory(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
    limit = 5,
  ): Promise<CategoryTotal[]> {
    const { from, to } = await this.resolveRange(userId, range);
    return this.expenseRepository.categoryTotals(
      userId,
      from,
      to,
      bucket ?? null,
      clamp(limit, 1, 20),
    );
  }

  async getIncome(
    userId: string,
    range: DateRange,
  ): Promise<{ total: number }> {
    const { from, to } = await this.resolveRange(userId, range);
    const total = await this.incomeRepository.sumTotalForMonth(
      userId,
      from,
      to,
    );
    return { total };
  }

  async getRecentExpenses(
    userId: string,
    opts: {
      limit?: number | undefined;
      category?: string | undefined;
      range?: DateRange | undefined;
    },
  ): Promise<RecentExpense[]> {
    // No default range here — "recent" spans all time unless the user narrows it.
    const range = opts.range
      ? await this.resolveRange(userId, opts.range)
      : undefined;
    const rows = await this.expenseRepository.findRecent(userId, {
      limit: clamp(opts.limit ?? 10, 1, 50),
      categoryName: opts.category,
      from: range?.from,
      to: range?.to,
    });
    return rows.map((r) => ({
      date: r.date.toISOString(),
      amount: r.amount,
      bucket: r.bucket,
      category: r.categoryName,
      note: r.note,
    }));
  }

  async getRecurringRules(userId: string): Promise<RecurringRuleSummary[]> {
    const rules = await this.recurringRuleRepository.findByUserId(userId);
    return Promise.all(
      rules.map(async (r) => {
        let category: string | null = null;
        if (r.categoryId) {
          const c = await this.categoryRepository.findById(r.categoryId);
          category = c?.name ?? null;
        }
        return {
          kind: r.kind,
          amount: Number(r.amount),
          dayOfMonth: r.dayOfMonth,
          bucket: r.bucket ?? null,
          category,
          note: r.note ?? null,
        };
      }),
    );
  }

  private async requireUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error(`FinancialDataTools: user ${userId} not found`);
    return user;
  }

  // Resolve an ISO range to concrete Dates, defaulting to the current cycle.
  private async resolveRange(
    userId: string,
    range: DateRange,
  ): Promise<{ from: Date; to: Date }> {
    const user = await this.requireUser(userId);
    const period = currentBudgetPeriod(user.payday);
    const from = parseDate(range.from) ?? period.start;
    const to = parseDate(range.to) ?? period.end;
    return { from, to };
  }
}

function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(n) || min, min), max);
}
