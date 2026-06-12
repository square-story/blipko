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
