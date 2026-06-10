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

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
  return `₹${inr.format(Math.round(amount))}`;
}

export interface MonthDayInfo {
  day: number; // 1-based day of month
  daysInMonth: number;
  remainingDays: number; // days left including today (>= 1)
}

export function monthDayInfo(now: Date = new Date()): MonthDayInfo {
  const day = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  return { day, daysInMonth, remainingDays: daysInMonth - day + 1 };
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
