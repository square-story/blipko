// Plain-language captions for the analytics charts.
//
// These run on the server and ship one finished string per chart, because the
// money formatting depends on the user's currency and locale — formatting on
// the client would mean either passing those down or risking a server/client
// Intl mismatch, which is a real hydration hazard.
//
// Every builder returns `Insight | null`. `null` means "not enough data to say
// anything honest" and the UI drops the caption row entirely; it never means
// "empty string". The guards matter more than the wording: without a material
// floor you cheerfully report "Chai up 400%" off a ₹40 → ₹200 move.
//
// Deliberately free of Prisma and of the action return types, so it stays unit
// testable and can't form an import cycle with lib/actions/analytics.ts.

import { formatMoney, type CategoryPacing } from "@/lib/budget";

export type InsightTone = "positive" | "negative" | "neutral" | "warning";

export interface Insight {
  text: string;
  tone: InsightTone;
}

// Percentage change, or null when there is no baseline to compare against.
// Mirrors getCategoryDetail's existing `prevSpend > 0 ? … : null` handling.
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// Changes smaller than this read as noise, not signal.
const FLAT_PCT = 1;

export interface DeltaInsightArgs {
  label: string;
  current: number;
  previous: number;
  currency: string;
  locale: string;
  /** Spend going up is bad; savings going up is good. Defaults to spend. */
  higherIsWorse?: boolean;
  /** Absolute amount below which the change isn't worth a sentence. */
  materialFloor?: number;
}

export function deltaInsight(args: DeltaInsightArgs): Insight | null {
  const {
    label,
    current,
    previous,
    currency,
    locale,
    higherIsWorse = true,
    materialFloor = 0,
  } = args;

  const pct = pctChange(current, previous);
  if (pct === null) return null;

  const delta = current - previous;
  if (Math.abs(delta) < materialFloor) return null;

  if (Math.abs(pct) < FLAT_PCT) {
    return { text: `${label} is flat versus last cycle.`, tone: "neutral" };
  }

  const up = delta > 0;
  const amount = formatMoney(Math.abs(delta), currency, locale);
  const worse = up === higherIsWorse;

  return {
    text: `${label} is ${up ? "up" : "down"} ${Math.abs(Math.round(pct))}% versus last cycle (${up ? "+" : "−"}${amount}).`,
    tone: worse ? "negative" : "positive",
  };
}

export interface PacingInsightArgs {
  pacing: CategoryPacing;
  spent: number;
  budget: number | null;
  remainingDays: number;
  currency: string;
  locale: string;
}

// Burn-rate guidance for the cycle as a whole. Silent when there is no budget
// to pace against, or when too little of the cycle has elapsed for the
// projection to mean anything (categoryPacing.reliable encodes that: day >= 3).
export function pacingInsight(args: PacingInsightArgs): Insight | null {
  const { pacing, spent, budget, remainingDays, currency, locale } = args;

  if (budget === null || budget <= 0) return null;

  if (pacing.overSpent) {
    const over = formatMoney(spent - budget, currency, locale);
    return {
      text: `You're ${over} over budget for this cycle.`,
      tone: "negative",
    };
  }

  if (!pacing.reliable) return null;

  const safeDaily = formatMoney(pacing.safeDaily, currency, locale);

  if (pacing.overPace) {
    const projected = formatMoney(pacing.projectedMonth, currency, locale);
    return {
      text: `At this rate you'll finish the cycle around ${projected} — over budget. Keep it under ${safeDaily} a day for the remaining ${remainingDays} days.`,
      tone: "warning",
    };
  }

  return {
    text: `On track. You can spend ${safeDaily} a day for the remaining ${remainingDays} days and stay within budget.`,
    tone: "positive",
  };
}

export interface SavingsRateRow {
  trueSavingsRatePct: number | null;
}

// Reads the savings-rate series. Cycles with no logged income contribute
// nothing — averaging a null as zero would invent a bad month.
export function savingsRateInsight(
  rows: SavingsRateRow[],
  targetPct?: number,
): Insight | null {
  const known = rows
    .map((r) => r.trueSavingsRatePct)
    .filter((v): v is number => v !== null);

  if (known.length === 0) return null;

  const latest = known[known.length - 1]!;
  const avg = known.reduce((a, b) => a + b, 0) / known.length;
  const rounded = Math.round(latest);

  if (targetPct !== undefined && targetPct > 0) {
    if (latest >= targetPct) {
      return {
        text: `You saved ${rounded}% this cycle, at or above your ${Math.round(targetPct)}% target.`,
        tone: "positive",
      };
    }
    return {
      text: `You saved ${rounded}% this cycle, short of your ${Math.round(targetPct)}% target.`,
      tone: "warning",
    };
  }

  if (known.length === 1) {
    return {
      text: `You saved ${rounded}% of income this cycle.`,
      tone: "neutral",
    };
  }

  return {
    text: `You saved ${rounded}% this cycle, against a ${Math.round(avg)}% average.`,
    tone: latest >= avg ? "positive" : "warning",
  };
}

export interface CommitmentTotalsLike {
  committed: number;
  incomeBasis: number;
  committedPct: number | null;
}

// How much of the month is spoken for before any discretionary spending.
export function commitmentLoadInsight(
  totals: CommitmentTotalsLike,
  currency: string,
  locale: string,
): Insight | null {
  const { committed, incomeBasis, committedPct } = totals;
  if (committed <= 0) return null;

  const amount = formatMoney(committed, currency, locale);

  if (committedPct === null || incomeBasis <= 0) {
    return {
      text: `${amount} a month is committed to recurring charges.`,
      tone: "neutral",
    };
  }

  const pct = Math.round(committedPct);
  const free = formatMoney(
    Math.max(0, incomeBasis - committed),
    currency,
    locale,
  );

  return {
    text: `${amount} a month — ${pct}% of your income — is committed before you spend anything. That leaves ${free}.`,
    tone: pct >= 70 ? "negative" : pct >= 50 ? "warning" : "neutral",
  };
}

export interface WeekdayRowLike {
  weekday: string;
  total: number;
}

// Names the heaviest weekday, but only when it actually stands out. A flat
// week shouldn't be dressed up as a habit.
export function weekdayInsight(
  rows: WeekdayRowLike[],
  currency: string,
  locale: string,
): Insight | null {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total <= 0) return null;

  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a));
  if (peak.total <= 0) return null;

  const evenShare = total / rows.length;
  // Under a 25% lead over an even split, the "peak" is just noise.
  if (peak.total < evenShare * 1.25) {
    return {
      text: "Your spending is spread evenly across the week.",
      tone: "neutral",
    };
  }

  const share = Math.round((peak.total / total) * 100);
  const amount = formatMoney(peak.total, currency, locale);

  return {
    text: `${peak.weekday} is your heaviest day — ${amount}, ${share}% of the period's spending.`,
    tone: "neutral",
  };
}
