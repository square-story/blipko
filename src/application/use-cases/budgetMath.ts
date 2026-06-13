import { Bucket } from "@prisma/client";

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

// First day of the current month (inclusive) to first day of next month (exclusive).
export function currentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// Clamp a payday to a safe 1–28 (no Feb/30-day edge cases).
function clampPayday(payday: number): number {
  return Math.min(Math.max(Math.floor(payday) || 1, 1), 28);
}

// The current budget cycle [start, end): from the most recent payday on/before
// `now` to the next payday. payday=1 reproduces the calendar month.
export function currentBudgetPeriod(
  payday: number,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const d = clampPayday(payday);
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

// The income to budget against this month: the expected salary is a floor, and
// actual income logged this month expands it above that floor. Lets salaried
// and variable-income users share one rule (gig users set expected = 0).
export function effectiveMonthlyIncome(
  expected: number,
  incomeThisMonth: number,
): number {
  return Math.max(expected, incomeThisMonth);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
  return `₹${inr.format(Math.round(amount))}`;
}

export interface PeriodDayInfo {
  day: number; // 1-based day within the cycle
  daysInPeriod: number;
  remainingDays: number; // days left including today (>= 1)
}

// Opaque per-cycle key (the period start date) — scopes once-per-cycle nudges
// and could key other per-period state. payday=1 → e.g. "2026-06-01".
export function periodKey(payday: number, now: Date = new Date()): string {
  const { start } = currentBudgetPeriod(payday, now);
  const y = start.getFullYear();
  const mo = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// Integer percentage of budget spent (0 when budget is 0).
export function pctSpent(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.round((spent / budget) * 100);
}

// 10-char unicode progress bar, clamped to [0, width].
export function progressBar(pct: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// Strip legacy-Markdown control chars from user-supplied text so a stray
// underscore/asterisk in a note can't break the message formatting.
export function sanitizeMd(text: string): string {
  return text.replace(/[*_`[\]]/g, "").trim();
}

export interface SelectedLeaf {
  name: string;
  bucket: Bucket;
  weight: number;
}

// Suggest a monthly budget per selected leaf category. Each bucket's budget
// (income × split%) is split across the leaves in that bucket in proportion to
// their weights, normalized over only the leaves the user actually selected — so
// the per-category suggestions always add up to the bucket budget. Returns a map
// keyed by leaf name → rounded ₹ amount.
export function suggestCategoryBudgets(
  income: number,
  split: BudgetSplit,
  leaves: SelectedLeaf[],
): Map<string, number> {
  const result = new Map<string, number>();
  const buckets: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];
  for (const bucket of buckets) {
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
