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
