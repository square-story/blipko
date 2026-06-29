import { Bucket } from "@prisma/client";

// 50/30/20 buckets, in display order.
export const BUCKETS: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

export const BUCKET_META: Record<Bucket, { label: string; emoji: string }> = {
  NEEDS: { label: "Needs", emoji: "🏠" },
  WANTS: { label: "Wants", emoji: "🎯" },
  SAVINGS: { label: "Savings", emoji: "💰" },
};

export interface BudgetSplit {
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
}

export const DEFAULT_SPLIT: BudgetSplit = {
  needsPct: 50,
  wantsPct: 30,
  savingsPct: 20,
};

// First day of the current month (inclusive) to first day of next month (exclusive).
export function currentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// The current budget cycle [start, end): most recent payday on/before `now` to
// the next payday. payday=1 reproduces the calendar month. Mirrors the backend.
export function currentBudgetPeriod(
  payday: number,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const d = Math.min(Math.max(Math.floor(payday) || 1, 1), 28);
  const y = now.getFullYear();
  const m = now.getMonth();
  if (now.getDate() >= d) {
    return { start: new Date(y, m, d), end: new Date(y, m + 1, d) };
  }
  return { start: new Date(y, m - 1, d), end: new Date(y, m, d) };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PeriodDayInfo {
  day: number; // 1-based day within the cycle
  daysInPeriod: number;
  remainingDays: number; // days left including today (>= 1)
}

// Where we are in the current budget cycle. Mirrors the backend
// `budgetMath.periodDayInfo`.
export function periodDayInfo(
  payday: number,
  now: Date = new Date(),
): PeriodDayInfo {
  const { start, end } = currentBudgetPeriod(payday, now);
  const daysInPeriod = Math.round(
    (end.getTime() - start.getTime()) / MS_PER_DAY,
  );
  const day = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return {
    day,
    daysInPeriod,
    remainingDays: Math.max(1, daysInPeriod - day + 1),
  };
}

export interface CategoryPacing {
  dailyRate: number; // avg spend/day so far
  weekly: number; // projected weekly run-rate
  projectedMonth: number; // projected spend by cycle end at current rate
  safeDaily: number; // ₹/day left to stay under the limit (0 if no limit)
  overPace: boolean; // projected to exceed the limit
  overSpent: boolean; // already over the limit
  reliable: boolean; // enough of the cycle elapsed for the projection to mean anything
}

// Burn-rate guidance for one category from spend-so-far + where we are in the
// cycle. Mirrors the bot's safe-daily-spend (remaining / remainingDays).
export function categoryPacing(args: {
  spent: number;
  limit: number | null;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
}): CategoryPacing {
  const { spent, limit, day, daysInPeriod, remainingDays } = args;
  const dailyRate = day > 0 ? spent / day : 0;
  const hasLimit = limit != null && limit > 0;
  return {
    dailyRate,
    weekly: dailyRate * 7,
    projectedMonth: dailyRate * daysInPeriod,
    safeDaily: hasLimit ? Math.max(0, limit - spent) / remainingDays : 0,
    overPace: hasLimit ? dailyRate * daysInPeriod > limit : false,
    overSpent: hasLimit ? spent > limit : false,
    // First couple of days, one expense skews the run-rate wildly — don't trust
    // the projection yet.
    reliable: day >= 3,
  };
}

// Distribute `budget` across categories weighted by recent spend; fall back to
// current limits, then an even split, when there's nothing to weight by.
// Pinned (budgetLocked) categories keep their amount and are excluded — only the
// remainder (budget − Σ pinned) is spread across the un-pinned ones, and only
// they are returned. Integer amounts that sum to the remainder exactly.
export function weightedBudgets(
  cats: {
    id: string;
    spend: number;
    monthlyBudget: number | null;
    budgetLocked?: boolean;
  }[],
  budget: number,
): { id: string; monthlyBudget: number }[] {
  const unlocked = cats.filter((c) => !c.budgetLocked);
  const n = unlocked.length;
  if (n === 0 || budget <= 0) return [];
  const lockedTotal = cats
    .filter((c) => c.budgetLocked)
    .reduce((s, c) => s + (c.monthlyBudget ?? 0), 0);
  const target = Math.max(0, budget - lockedTotal); // spread over un-pinned
  if (target <= 0) return unlocked.map((c) => ({ id: c.id, monthlyBudget: 0 }));
  // Floor so a never-used category never lands at ₹0; the rest is by weight.
  const minShare = Math.floor((target / n) * 0.1);
  const pool = target - minShare * n;
  const totalSpend = unlocked.reduce((s, c) => s + Math.max(0, c.spend), 0);
  const totalLimit = unlocked.reduce((s, c) => s + (c.monthlyBudget ?? 0), 0);
  const weightOf = (c: { spend: number; monthlyBudget: number | null }) =>
    totalSpend > 0
      ? Math.max(0, c.spend)
      : totalLimit > 0
        ? (c.monthlyBudget ?? 0)
        : 1; // even
  const totalWeight = unlocked.reduce((s, c) => s + weightOf(c), 0);
  const raw = unlocked.map((c) => ({
    id: c.id,
    amount: minShare + Math.floor((pool * weightOf(c)) / totalWeight),
    w: weightOf(c),
  }));
  let remainder = target - raw.reduce((s, r) => s + r.amount, 0);
  // Hand the rounding leftover to the largest-weight categories.
  raw.sort((a, b) => b.w - a.w);
  for (let i = 0; remainder > 0; i = (i + 1) % n, remainder--)
    raw[i].amount += 1;
  return raw.map((r) => ({ id: r.id, monthlyBudget: r.amount }));
}

export function bucketPct(split: BudgetSplit, bucket: Bucket): number {
  switch (bucket) {
    case "NEEDS":
      return split.needsPct;
    case "WANTS":
      return split.wantsPct;
    case "SAVINGS":
      return split.savingsPct;
  }
}

export function bucketBudget(
  monthlyIncome: number,
  split: BudgetSplit,
  bucket: Bucket,
): number {
  return (monthlyIncome * bucketPct(split, bucket)) / 100;
}

// The income to budget against this month: expected salary is a floor, actual
// income logged this month expands it above that floor. Matches the backend.
export function effectiveMonthlyIncome(
  expected: number,
  incomeThisMonth: number,
): number {
  return Math.max(expected, incomeThisMonth);
}

// Integer percentage of budget spent (0 when budget is 0).
export function pctSpent(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.round((spent / budget) * 100);
}

export function formatMoney(
  amount: number,
  currency: string = "INR",
  locale: string = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface SelectedLeaf {
  name: string;
  bucket: Bucket;
  weight: number;
}

// Suggest a monthly budget per selected leaf. Each bucket's budget is split
// across its leaves in proportion to their weights, normalized over only the
// selected leaves so the per-category suggestions sum to the bucket budget.
// Port of `src/application/use-cases/budgetMath.ts` suggestCategoryBudgets.
export function suggestCategoryBudgets(
  income: number,
  split: BudgetSplit,
  leaves: SelectedLeaf[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const bucket of BUCKETS) {
    const inBucket = leaves.filter((l) => l.bucket === bucket);
    const totalWeight = inBucket.reduce((s, l) => s + l.weight, 0);
    if (totalWeight <= 0) continue;
    const budget = bucketBudget(income, split, bucket);
    for (const leaf of inBucket) {
      result.set(leaf.name, Math.round((budget * leaf.weight) / totalWeight));
    }
  }
  return result;
}

export type NotificationDosage = "OFF" | "GENTLE" | "AGGRESSIVE" | "RELENTLESS";

// Shared so the onboarding wizard and Account settings show identical labels.
export const CURRENCIES = [
  { value: "INR", label: "INR (₹)", locale: "en-IN" },
  { value: "USD", label: "USD ($)", locale: "en-US" },
  { value: "EUR", label: "EUR (€)", locale: "en-IE" },
  { value: "GBP", label: "GBP (£)", locale: "en-GB" },
];

export const DOSAGES: {
  value: NotificationDosage;
  label: string;
  hint: string;
}[] = [
  { value: "OFF", label: "Off", hint: "No reminders" },
  { value: "GENTLE", label: "Gentle", hint: "1–2 a day" },
  { value: "AGGRESSIVE", label: "Aggressive", hint: "+ daily check-in" },
  { value: "RELENTLESS", label: "Relentless", hint: "Daily + repeats" },
];

export function localeForCurrency(currency: string): string {
  return CURRENCIES.find((c) => c.value === currency)?.locale ?? "en-IN";
}
