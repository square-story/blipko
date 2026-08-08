"use server";

import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Bucket, RecurringKind } from "@prisma/client";
import {
  BUCKETS,
  BUCKET_META,
  DEFAULT_SPLIT,
  bucketBudget,
  categoryPacing,
  effectiveMonthlyIncome,
  pctSpent,
  type BudgetSplit,
  type CategoryPacing,
} from "@/lib/budget";
import {
  cycleIndexer,
  zonedCycleWindows,
  zonedHour,
  zonedParts,
  zonedPeriodDayInfo,
  zonedWeekday,
  zonedYmd,
  type CycleWindow,
} from "@/lib/time";
import {
  commitmentLoadInsight,
  deltaInsight,
  pacingInsight,
  savingsRateInsight,
  weekdayInsight,
  type Insight,
} from "@/lib/insights";
import { UNCATEGORIZED_ID, expensesHref } from "@/lib/analytics/drilldown";
import { getRecurringRules } from "@/lib/actions/recurring";

// ---------------------------------------------------------------------------
// Shared shapes
//
// Every action returns { meta, …series, insights }. Series rows are flat
// objects because the chart components take Record<string, unknown>[] plus an
// xDataKey.
// ---------------------------------------------------------------------------

export interface CycleMeta {
  key: string; // zonedYmd(start) — stable React key
  label: string; // "Jul 25", formatted in the user's tz and locale
  start: number; // epoch ms, inclusive
  end: number; // epoch ms, exclusive
  days: number; // 28-31; cycles genuinely vary
  isCurrent: boolean;
}

export interface AnalyticsMeta {
  currency: string;
  locale: string;
  timezone: string;
  payday: number;
  cycles: CycleMeta[]; // oldest first, current partial cycle last
  cyclesRequested: number;
  cyclesAvailable: number;
}

const MAX_CYCLES = 12;
const MIN_MATERIAL_FRACTION = 0.02;

function clampCycles(n: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(n ?? 6) || 6), MAX_CYCLES);
}

interface AnalyticsContext {
  userId: string;
  currency: string;
  locale: string;
  timezone: string;
  payday: number;
  expectedIncome: number;
  split: BudgetSplit;
  createdAt: Date;
}

// Wrapped in cache() so the five actions share one auth + user + config read
// within a render pass. Not exported: "use server" requires every export to be
// an async function, and this is fine as a module-private const.
const loadContext = cache(async (): Promise<AnalyticsContext> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [user, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        currency: true,
        locale: true,
        timezone: true,
        payday: true,
        monthlyIncome: true,
        createdAt: true,
      },
    }),
    prisma.budgetConfig.findUnique({ where: { userId } }),
  ]);

  return {
    userId,
    currency: user?.currency ?? "INR",
    locale: user?.locale ?? "en-IN",
    timezone: user?.timezone ?? "Asia/Kolkata",
    payday: user?.payday ?? 1,
    expectedIncome: Number(user?.monthlyIncome ?? 0),
    split: config
      ? {
          needsPct: config.needsPct,
          wantsPct: config.wantsPct,
          savingsPct: config.savingsPct,
        }
      : DEFAULT_SPLIT,
    createdAt: user?.createdAt ?? new Date(0),
  };
});

// Cycle windows for this user, clamped to the life of the account. Without the
// clamp a two-week-old account asking for 12 cycles gets ten windows of zeroes,
// which reads as "you stopped spending" rather than "there's no data yet".
function windowsFor(ctx: AnalyticsContext, cycles: number): CycleWindow[] {
  const all = zonedCycleWindows(ctx.payday, cycles, ctx.timezone, ctx.locale);
  const live = all.filter((w) => w.end.getTime() > ctx.createdAt.getTime());
  return live.length ? live : all.slice(-1);
}

function toMeta(
  ctx: AnalyticsContext,
  windows: CycleWindow[],
  requested: number,
): AnalyticsMeta {
  return {
    currency: ctx.currency,
    locale: ctx.locale,
    timezone: ctx.timezone,
    payday: ctx.payday,
    cycles: windows.map((w, i) => ({
      key: w.key,
      label: w.label,
      start: w.start.getTime(),
      end: w.end.getTime(),
      days: w.days,
      isCurrent: i === windows.length - 1,
    })),
    cyclesRequested: requested,
    cyclesAvailable: windows.length,
  };
}

function span(windows: CycleWindow[]) {
  return {
    gte: windows[0]!.start,
    lt: windows[windows.length - 1]!.end,
  };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface CyclePacing {
  spent: number;
  budget: number | null; // null when there is no income signal to budget against
  pct: number;
  dailyRate: number;
  safeDaily: number;
  projected: number;
  overPace: boolean;
  overSpent: boolean;
  reliable: boolean;
}

export type BurnDownRow = {
  day: number;
  dateLabel: string;
  /**
   * One continuous series: real cumulative spend up to today, then the current
   * run-rate extended to the end of the cycle. The chart renders the forecast
   * half dashed rather than plotting it as a second line.
   *
   * Deliberately never null. bklit's Line maps a non-number to pixel y=0, so a
   * gap would draw a spike to the top of the plot rather than a break.
   */
  spent: number;
  /** Straight-line pace that lands exactly on budget. 0 when there is none. */
  ideal: number;
  /** Marks where the forecast starts, for dashing. */
  isForecast: boolean;
};

export type BucketTrendRow = {
  cycle: string;
  cycleKey: string;
  NEEDS: number;
  WANTS: number;
  SAVINGS: number;
  total: number;
  perDay: number; // makes 28- and 31-day cycles comparable
  href: string;
};

export interface BucketPacing extends CyclePacing {
  bucket: Bucket;
  label: string;
  href: string;
}

export interface OverviewAnalytics {
  meta: AnalyticsMeta;
  current: {
    label: string;
    day: number;
    daysInPeriod: number;
    remainingDays: number;
    income: number;
    spend: number;
    net: number;
    savingsRatePct: number | null;
  };
  wholeBudget: CyclePacing;
  byBucket: BucketPacing[];
  burnDown: BurnDownRow[];
  bucketTrend: BucketTrendRow[];
  topCategories: { name: string; value: number; pct: number }[];
  insights: {
    pacing: Insight | null;
    bucketTrend: Insight | null;
  };
}

function toCyclePacing(
  spent: number,
  budget: number | null,
  pacing: CategoryPacing,
): CyclePacing {
  return {
    spent,
    budget,
    pct: budget && budget > 0 ? pctSpent(spent, budget) : 0,
    dailyRate: pacing.dailyRate,
    safeDaily: pacing.safeDaily,
    projected: pacing.projectedMonth,
    overPace: pacing.overPace,
    overSpent: pacing.overSpent,
    reliable: pacing.reliable,
  };
}

export async function getOverviewAnalytics(
  cycles?: number,
): Promise<OverviewAnalytics> {
  const ctx = await loadContext();
  const requested = clampCycles(cycles);
  const windows = windowsFor(ctx, requested);
  const current = windows[windows.length - 1]!;
  const { gte, lt } = span(windows);

  const [expenses, incomeAgg, categoryGroups] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: ctx.userId, isDeleted: false, date: { gte, lt } },
      select: { amount: true, date: true, bucket: true },
    }),
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        userId: ctx.userId,
        isDeleted: false,
        date: { gte: current.start, lt: current.end },
      },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: {
        userId: ctx.userId,
        isDeleted: false,
        date: { gte: current.start, lt: current.end },
      },
    }),
  ]);

  const indexOf = cycleIndexer(windows);

  // Per-cycle bucket totals, bucketed in memory from the single query above.
  const perCycle = windows.map(() => ({ NEEDS: 0, WANTS: 0, SAVINGS: 0 }));
  // Cumulative spend by day-of-cycle for the current cycle only.
  const spendByDay = new Array<number>(current.days + 1).fill(0);

  for (const e of expenses) {
    const i = indexOf(e.date);
    if (i < 0) continue;
    const amount = Number(e.amount);
    perCycle[i]![e.bucket] += amount;

    if (i === windows.length - 1) {
      const dayIndex = Math.floor(
        (e.date.getTime() - current.start.getTime()) / 86_400_000,
      );
      if (dayIndex >= 0 && dayIndex < current.days) {
        spendByDay[dayIndex + 1]! += amount;
      }
    }
  }

  const bucketTrend: BucketTrendRow[] = windows.map((w, i) => {
    const b = perCycle[i]!;
    const total = b.NEEDS + b.WANTS + b.SAVINGS;
    return {
      cycle: w.label,
      cycleKey: w.key,
      NEEDS: b.NEEDS,
      WANTS: b.WANTS,
      SAVINGS: b.SAVINGS,
      total,
      perDay: w.days > 0 ? total / w.days : 0,
      href: expensesHref({ from: w.start, to: w.end }),
    };
  });

  const income = Number(incomeAgg._sum.amount ?? 0);
  const spend = bucketTrend[bucketTrend.length - 1]!.total;
  const { day, daysInPeriod, remainingDays } = zonedPeriodDayInfo(
    ctx.payday,
    ctx.timezone,
  );

  // The current cycle's budget follows the app's existing rule: expected salary
  // is a floor, actual logged income lifts it. Zero income means no budget at
  // all rather than a budget of zero, so nothing divides by it.
  const monthlyIncome = effectiveMonthlyIncome(ctx.expectedIncome, income);
  const budget = monthlyIncome > 0 ? monthlyIncome : null;

  const wholePacing = categoryPacing({
    spent: spend,
    limit: budget,
    day,
    daysInPeriod,
    remainingDays,
  });
  const wholeBudget = toCyclePacing(spend, budget, wholePacing);

  const byBucket: BucketPacing[] = BUCKETS.map((bucket) => {
    const spent = perCycle[perCycle.length - 1]![bucket];
    const limit =
      budget === null ? null : bucketBudget(budget, ctx.split, bucket);
    const pacing = categoryPacing({
      spent,
      limit,
      day,
      daysInPeriod,
      remainingDays,
    });
    return {
      ...toCyclePacing(spent, limit, pacing),
      bucket,
      label: BUCKET_META[bucket].label,
      href: expensesHref({
        buckets: [bucket],
        from: current.start,
        to: current.end,
      }),
    };
  });

  // Burn-down: cumulative actual to date, continuing as the current run-rate
  // for the rest of the cycle.
  const idealPerDay = budget === null ? 0 : budget / current.days;
  let running = 0;
  const burnDown: BurnDownRow[] = [];
  for (let d = 1; d <= current.days; d++) {
    const reached = d <= day;
    if (reached) running += spendByDay[d] ?? 0;
    burnDown.push({
      day: d,
      dateLabel: zonedYmd(
        new Date(current.start.getTime() + (d - 1) * 86_400_000),
        ctx.timezone,
      ),
      // Past days carry the real running total. Future days continue at the
      // observed daily rate — flat once too little of the cycle has elapsed for
      // that rate to mean anything, rather than projecting off two data points.
      spent: reached
        ? running
        : wholePacing.reliable
          ? wholePacing.dailyRate * d
          : running,
      ideal: idealPerDay * d,
      isForecast: !reached,
    });
  }

  const categoryIds = categoryGroups
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id);
  const categoryNames = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(categoryNames.map((c) => [c.id, c.name]));
  const topCategories = categoryGroups
    .map((g) => ({
      name: g.categoryId
        ? (nameById.get(g.categoryId) ?? "Uncategorized")
        : "Uncategorized",
      value: Number(g._sum.amount ?? 0),
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((c) => ({ ...c, pct: spend > 0 ? (c.value / spend) * 100 : 0 }));

  const previousTotal =
    bucketTrend.length > 1 ? bucketTrend[bucketTrend.length - 2]!.total : 0;

  return {
    meta: toMeta(ctx, windows, requested),
    current: {
      label: current.label,
      day,
      daysInPeriod,
      remainingDays,
      income,
      spend,
      net: income - spend,
      savingsRatePct: income > 0 ? ((income - spend) / income) * 100 : null,
    },
    wholeBudget,
    byBucket,
    burnDown,
    bucketTrend,
    topCategories,
    insights: {
      pacing: pacingInsight({
        pacing: wholePacing,
        spent: spend,
        budget,
        remainingDays,
        currency: ctx.currency,
        locale: ctx.locale,
      }),
      bucketTrend: deltaInsight({
        label: "Total spending",
        current: spend,
        previous: previousTotal,
        currency: ctx.currency,
        locale: ctx.locale,
        materialFloor: previousTotal * MIN_MATERIAL_FRACTION,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Cashflow
// ---------------------------------------------------------------------------

export type CashflowRow = {
  cycle: string;
  cycleKey: string;
  income: number;
  spend: number;
  net: number;
  cumulative: number; // running total of net across the window
  href: string;
};

export type SavingsRow = {
  cycle: string;
  cycleKey: string;
  income: number;
  unspent: number; // income − spend, signed
  trueSaved: number; // SAVINGS-bucket spend + genuine box contributions
  unspentRatePct: number | null; // null when no income was logged
  trueSavingsRatePct: number | null;
};

export type BoxFlowRow = {
  cycle: string;
  cycleKey: string;
  in: number;
  out: number;
  net: number;
};

export interface CashflowAnalytics {
  meta: AnalyticsMeta;
  cashflow: CashflowRow[];
  savings: SavingsRow[];
  boxes: BoxFlowRow[];
  cyclesWithoutIncome: number;
  insights: {
    cashflow: Insight | null;
    savings: Insight | null;
  };
}

export async function getCashflowAnalytics(
  cycles?: number,
): Promise<CashflowAnalytics> {
  const ctx = await loadContext();
  const requested = clampCycles(cycles);
  const windows = windowsFor(ctx, requested);
  const { gte, lt } = span(windows);

  const [expenses, incomes, boxEntries] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: ctx.userId, isDeleted: false, date: { gte, lt } },
      select: { amount: true, date: true, bucket: true },
    }),
    prisma.income.findMany({
      where: { userId: ctx.userId, isDeleted: false, date: { gte, lt } },
      select: { amount: true, date: true },
    }),
    prisma.boxEntry.findMany({
      where: { userId: ctx.userId, isDeleted: false, date: { gte, lt } },
      select: {
        amount: true,
        date: true,
        direction: true,
        isTracking: true,
        sourceExpenseId: true,
        sourceIncomeId: true,
      },
    }),
  ]);

  const indexOf = cycleIndexer(windows);
  const agg = windows.map(() => ({
    income: 0,
    spend: 0,
    savingsBucket: 0,
    boxIn: 0,
    boxOut: 0,
    boxContributed: 0,
  }));

  for (const e of expenses) {
    const i = indexOf(e.date);
    if (i < 0) continue;
    const amount = Number(e.amount);
    agg[i]!.spend += amount;
    if (e.bucket === "SAVINGS") agg[i]!.savingsBucket += amount;
  }

  for (const inc of incomes) {
    const i = indexOf(inc.date);
    if (i < 0) continue;
    agg[i]!.income += Number(inc.amount);
  }

  for (const b of boxEntries) {
    const i = indexOf(b.date);
    if (i < 0) continue;
    const amount = Number(b.amount);
    if (b.direction === "IN") {
      agg[i]!.boxIn += amount;
      // Only genuinely new money counts as savings. A "move to box" carries a
      // sourceExpenseId/sourceIncomeId and soft-deletes the transaction it came
      // from, so counting it would credit savings for money that has vanished
      // from the income side. A tracking link leaves its source live and is
      // excluded from the balance by convention.
      if (!b.isTracking && !b.sourceExpenseId && !b.sourceIncomeId) {
        agg[i]!.boxContributed += amount;
      }
    } else {
      agg[i]!.boxOut += amount;
    }
  }

  let cumulative = 0;
  const cashflow: CashflowRow[] = windows.map((w, i) => {
    const { income, spend } = agg[i]!;
    const net = income - spend;
    cumulative += net;
    return {
      cycle: w.label,
      cycleKey: w.key,
      income,
      spend,
      net,
      cumulative,
      href: expensesHref({ from: w.start, to: w.end }),
    };
  });

  const savings: SavingsRow[] = windows.map((w, i) => {
    const { income, spend, savingsBucket, boxContributed } = agg[i]!;
    const trueSaved = savingsBucket + boxContributed;
    return {
      cycle: w.label,
      cycleKey: w.key,
      income,
      unspent: income - spend,
      trueSaved,
      // Income is taken per cycle as actually logged. user.monthlyIncome is a
      // current setting, not history — applying it backwards would invent
      // income for months before the user set it.
      unspentRatePct: income > 0 ? ((income - spend) / income) * 100 : null,
      trueSavingsRatePct: income > 0 ? (trueSaved / income) * 100 : null,
    };
  });

  const boxes: BoxFlowRow[] = windows.map((w, i) => ({
    cycle: w.label,
    cycleKey: w.key,
    in: agg[i]!.boxIn,
    out: agg[i]!.boxOut,
    net: agg[i]!.boxIn - agg[i]!.boxOut,
  }));

  const latest = cashflow[cashflow.length - 1]!;
  const previous = cashflow.length > 1 ? cashflow[cashflow.length - 2]! : null;

  return {
    meta: toMeta(ctx, windows, requested),
    cashflow,
    savings,
    boxes,
    cyclesWithoutIncome: savings.filter((s) => s.income <= 0).length,
    insights: {
      cashflow: previous
        ? deltaInsight({
            label: "Net cashflow",
            current: latest.net,
            previous: previous.net,
            currency: ctx.currency,
            locale: ctx.locale,
            higherIsWorse: false,
            materialFloor: Math.abs(previous.net) * MIN_MATERIAL_FRACTION,
          })
        : null,
      savings: savingsRateInsight(savings, ctx.split.savingsPct),
    },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategorySliceRow = {
  id: string;
  name: string;
  value: number;
  pct: number;
  href: string | null;
};

export type MoverDirection = "up" | "down" | "new" | "stopped" | "flat";

export type CategoryMoverRow = {
  id: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  direction: MoverDirection;
  /**
   * Magnitude of the change, split by direction so each side gets its own fill
   * — Bar takes a single colour. Both are positive: a negative value produces a
   * negative SVG rect width, which the browser rejects outright.
   */
  increase: number;
  decrease: number;
  href: string | null;
};

export interface CategoryAnalytics {
  meta: AnalyticsMeta;
  breakdown: CategorySliceRow[];
  movers: CategoryMoverRow[];
  hasPreviousCycle: boolean;
  insights: {
    breakdown: Insight | null;
    movers: Insight | null;
  };
}

// Takes no range: every figure here is "this cycle" or "versus last cycle", so
// two windows is all there is to ask for. It used to accept the page's range
// and build up to twelve windows through zonedCycleWindows before discarding
// all but the last two — the cycle control is hidden on this tab for the same
// reason (see RANGE_AWARE_TABS).
export async function getCategoryAnalytics(): Promise<CategoryAnalytics> {
  const ctx = await loadContext();
  const windows = windowsFor(ctx, 2);
  const current = windows[windows.length - 1]!;
  const previous = windows.length > 1 ? windows[windows.length - 2] : null;

  const scan = previous ? previous : current;
  const expenses = await prisma.expense.findMany({
    where: {
      userId: ctx.userId,
      isDeleted: false,
      date: { gte: scan.start, lt: current.end },
    },
    select: { amount: true, date: true, categoryId: true },
  });

  const currentByCat = new Map<string, number>();
  const previousByCat = new Map<string, number>();

  for (const e of expenses) {
    const id = e.categoryId ?? UNCATEGORIZED_ID;
    const amount = Number(e.amount);
    const t = e.date.getTime();
    if (t >= current.start.getTime() && t < current.end.getTime()) {
      currentByCat.set(id, (currentByCat.get(id) ?? 0) + amount);
    } else if (
      previous &&
      t >= previous.start.getTime() &&
      t < previous.end.getTime()
    ) {
      previousByCat.set(id, (previousByCat.get(id) ?? 0) + amount);
    }
  }

  const ids = [
    ...new Set([...currentByCat.keys(), ...previousByCat.keys()]),
  ].filter((id) => id !== UNCATEGORIZED_ID);

  // One lookup, keyed by id rather than userId: expenses can still point at
  // system categories, which have userId null.
  const categories = ids.length
    ? await prisma.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  // Names resolve live, so renaming a category retroactively relabels its
  // history. Correct, but it means old charts can change wording.
  const nameOf = (id: string) =>
    id === UNCATEGORIZED_ID ? "Uncategorized" : (nameById.get(id) ?? "Deleted");

  const currentTotal = [...currentByCat.values()].reduce((a, b) => a + b, 0);

  const breakdown: CategorySliceRow[] = [...currentByCat.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({
      id,
      name: nameOf(id),
      value,
      pct: currentTotal > 0 ? (value / currentTotal) * 100 : 0,
      href:
        id === UNCATEGORIZED_ID
          ? null
          : expensesHref({
              categoryIds: [id],
              from: current.start,
              to: current.end,
            }),
    }));

  // Without a complete previous cycle every category would be labelled "new",
  // which says more about the account's age than about spending.
  const hasPreviousCycle =
    previous !== null && previous.end.getTime() > ctx.createdAt.getTime();

  const movers: CategoryMoverRow[] = !hasPreviousCycle
    ? []
    : [...new Set([...currentByCat.keys(), ...previousByCat.keys()])]
        .map((id) => {
          const cur = currentByCat.get(id) ?? 0;
          const prev = previousByCat.get(id) ?? 0;
          const delta = cur - prev;
          const deltaPct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
          let direction: MoverDirection;
          if (prev <= 0) direction = "new";
          else if (cur <= 0) direction = "stopped";
          else if (deltaPct !== null && Math.abs(deltaPct) < 1)
            direction = "flat";
          else direction = delta > 0 ? "up" : "down";

          return {
            id,
            name: nameOf(id),
            current: cur,
            previous: prev,
            delta,
            deltaPct,
            direction,
            increase: delta > 0 ? delta : 0,
            decrease: delta < 0 ? Math.abs(delta) : 0,
            href:
              id === UNCATEGORIZED_ID
                ? null
                : expensesHref({ categoryIds: [id] }),
          };
        })
        .filter((m) => Math.abs(m.delta) > 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 8);

  const biggest = movers[0] ?? null;

  return {
    meta: toMeta(ctx, windows, 2),
    breakdown,
    movers,
    hasPreviousCycle,
    insights: {
      breakdown:
        breakdown.length > 0
          ? {
              text: `${breakdown[0]!.name} is your largest category this cycle at ${Math.round(breakdown[0]!.pct)}% of spending.`,
              tone: "neutral",
            }
          : null,
      movers: biggest
        ? deltaInsight({
            label: biggest.name,
            current: biggest.current,
            previous: biggest.previous,
            currency: ctx.currency,
            locale: ctx.locale,
            materialFloor: currentTotal * MIN_MATERIAL_FRACTION,
          })
        : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Commitments
// ---------------------------------------------------------------------------

export interface CommitmentTotals {
  recurringExpense: number;
  recurringIncome: number;
  recurringBox: number;
  committed: number; // expense + box: money already spoken for
  incomeBasis: number;
  discretionary: number;
  committedPct: number | null;
}

export type ObligationRow = {
  cycleDay: number; // 1-based day within the cycle
  dayOfMonth: number;
  dateLabel: string;
  expense: number;
  income: number;
  box: number;
  isPayday: boolean;
  isPast: boolean;
};

export type CommitmentRuleRow = {
  id: string;
  kind: RecurringKind;
  label: string;
  amount: number;
  dayOfMonth: number;
  cycleDay: number;
  bucket: Bucket | null;
  // One column per kind so each renders with its own fill in a stacked bar.
  INCOME: number;
  EXPENSE: number;
  BOX: number;
};

export interface CommitmentAnalytics {
  meta: AnalyticsMeta;
  totals: CommitmentTotals;
  calendar: ObligationRow[];
  rules: CommitmentRuleRow[];
  insights: { load: Insight | null };
}

export async function getCommitmentAnalytics(): Promise<CommitmentAnalytics> {
  const ctx = await loadContext();
  const windows = windowsFor(ctx, 1);
  const current = windows[windows.length - 1]!;

  const [rules, incomeAgg, spendAgg] = await Promise.all([
    getRecurringRules(),
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        userId: ctx.userId,
        isDeleted: false,
        date: { gte: current.start, lt: current.end },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId: ctx.userId,
        isDeleted: false,
        date: { gte: current.start, lt: current.end },
      },
    }),
  ]);

  const sumOf = (kind: RecurringKind) =>
    rules.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0);

  const recurringExpense = sumOf("EXPENSE");
  const recurringIncome = sumOf("INCOME");
  const recurringBox = sumOf("BOX");
  const committed = recurringExpense + recurringBox;

  const loggedIncome = Number(incomeAgg._sum.amount ?? 0);
  const incomeBasis = effectiveMonthlyIncome(ctx.expectedIncome, loggedIncome);

  const totals: CommitmentTotals = {
    recurringExpense,
    recurringIncome,
    recurringBox,
    committed,
    incomeBasis,
    discretionary: Math.max(0, incomeBasis - committed),
    committedPct: incomeBasis > 0 ? (committed / incomeBasis) * 100 : null,
  };

  // Recurring rules fire on a calendar-month schedule, independent of the
  // payday cycle. A rule on the 5th under a payday of 25 lands on cycle day 12,
  // not day 5 — mapping that is the whole point of this chart.
  const cycleDayFor = (dayOfMonth: number): number => {
    for (let d = 0; d < current.days; d++) {
      const instant = new Date(current.start.getTime() + d * 86_400_000);
      const parts = zonedParts(instant, ctx.timezone);
      // Same clamp the poster applies, so a rule on the 31st lands on the last
      // day of a short month rather than never firing.
      const daysInMonth = new Date(
        Date.UTC(parts.year, parts.month, 0),
      ).getUTCDate();
      if (parts.day === Math.min(dayOfMonth, daysInMonth)) return d + 1;
    }
    return 1;
  };

  const { day: todayInCycle } = zonedPeriodDayInfo(ctx.payday, ctx.timezone);

  const calendar: ObligationRow[] = [];
  for (let d = 1; d <= current.days; d++) {
    const instant = new Date(current.start.getTime() + (d - 1) * 86_400_000);
    const parts = zonedParts(instant, ctx.timezone);
    calendar.push({
      cycleDay: d,
      dayOfMonth: parts.day,
      dateLabel: zonedYmd(instant, ctx.timezone),
      expense: 0,
      income: 0,
      box: 0,
      isPayday: d === 1,
      isPast: d <= todayInCycle,
    });
  }

  const ruleRows: CommitmentRuleRow[] = rules.map((r) => {
    const cycleDay = cycleDayFor(r.dayOfMonth);
    const slot = calendar[cycleDay - 1];
    if (slot) {
      if (r.kind === "EXPENSE") slot.expense += r.amount;
      else if (r.kind === "INCOME") slot.income += r.amount;
      else slot.box += r.amount;
    }
    return {
      id: r.id,
      kind: r.kind,
      label: r.note ?? r.categoryName ?? r.boxName ?? "Recurring",
      amount: r.amount,
      dayOfMonth: r.dayOfMonth,
      cycleDay,
      bucket: r.bucket,
      INCOME: r.kind === "INCOME" ? r.amount : 0,
      EXPENSE: r.kind === "EXPENSE" ? r.amount : 0,
      BOX: r.kind === "BOX" ? r.amount : 0,
    };
  });

  ruleRows.sort((a, b) => b.amount - a.amount);

  void spendAgg; // reserved: actual-versus-committed comparison

  return {
    meta: toMeta(ctx, windows, 1),
    totals,
    calendar,
    rules: ruleRows,
    insights: {
      load: commitmentLoadInsight(totals, ctx.currency, ctx.locale),
    },
  };
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export type WeekdayRow = {
  weekday: string;
  weekdayIndex: number;
  total: number;
  txnCount: number;
  avgPerOccurrence: number;
  NEEDS: number;
  WANTS: number;
  SAVINGS: number;
};

export interface HabitAnalytics {
  meta: AnalyticsMeta;
  byWeekday: WeekdayRow[];
  busiestHour: number | null;
  insights: { weekday: Insight | null };
}

// Monday first: a spending week reads better ending on the weekend than
// starting with half of it.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function getHabitAnalytics(
  cycles?: number,
): Promise<HabitAnalytics> {
  const ctx = await loadContext();
  const requested = clampCycles(cycles);
  const windows = windowsFor(ctx, requested);
  const { gte, lt } = span(windows);

  const expenses = await prisma.expense.findMany({
    where: { userId: ctx.userId, isDeleted: false, date: { gte, lt } },
    select: { amount: true, date: true, bucket: true },
  });

  const rows: WeekdayRow[] = WEEKDAYS.map((weekday, weekdayIndex) => ({
    weekday,
    weekdayIndex,
    total: 0,
    txnCount: 0,
    avgPerOccurrence: 0,
    NEEDS: 0,
    WANTS: 0,
    SAVINGS: 0,
  }));

  const hourTotals = new Array<number>(24).fill(0);

  for (const e of expenses) {
    // Weekday and hour both come from the user's wall clock. On a UTC server a
    // 01:00 IST expense would otherwise be filed under the previous day.
    const index = WEEKDAYS.indexOf(zonedWeekday(e.date, ctx.timezone));
    if (index < 0) continue;
    const amount = Number(e.amount);
    const row = rows[index]!;
    row.total += amount;
    row.txnCount += 1;
    row[e.bucket] += amount;
    hourTotals[zonedHour(e.date, ctx.timezone)]! += amount;
  }

  for (const row of rows) {
    row.avgPerOccurrence = row.txnCount > 0 ? row.total / row.txnCount : 0;
  }

  const peakHour = hourTotals.reduce(
    (best, v, i) => (v > hourTotals[best]! ? i : best),
    0,
  );

  return {
    meta: toMeta(ctx, windows, requested),
    byWeekday: rows,
    // Hour-of-day gets one number rather than its own chart: recurring charges
    // are auto-posted at a fixed hour and ExpenseSource has no value to tell
    // them apart, so an hourly distribution would mostly show the cron.
    busiestHour: hourTotals[peakHour]! > 0 ? peakHour : null,
    insights: {
      weekday: weekdayInsight(rows, ctx.currency, ctx.locale),
    },
  };
}
