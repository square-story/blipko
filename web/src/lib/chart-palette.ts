// The single source of colour for charts, meters and KPI tones.
//
// Before this file the same conceptual thing was coloured four different ways
// on adjacent screens: bucket pastels in --chart-needs/wants/savings, a
// hardcoded ["#0088FE", …] array in the donut, Tailwind bg-emerald-500 on the
// dashboard meters, and stock --chart-1..5 that nothing used at all. A category
// could be a pastel in one chart, a saturated blue in the next, and an emerald
// bar on the page linking to both.
//
// Everything now resolves through --chart-1..5 (already themed for light and
// dark in globals.css) plus the semantic status tokens.
//
// Not in lib/budget.ts on purpose: that module is the shared budget maths,
// imported by server actions and mirrored from the bot. Presentation tokens
// don't belong in it.

import type { Bucket } from "@prisma/client";

// Categorical series colours, for anything without inherent meaning —
// categories, box names, arbitrary groupings.
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

// Tailwind equivalents, for meters and legend swatches. These need no dark:
// variant — --chart-1..5 already differ per theme, which is why the old
// CATEGORY_COLORS array needed a `dark:` half and this doesn't.
export const SERIES_CLASS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

// Wraps around past five. A user with six or more categories sees the first
// colour repeat; the donut sorts by value and the ranked lists cap at five, so
// the repeat lands where it reads as "everything else".
export const seriesColor = (i: number): string =>
  SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length]!;

export const seriesClass = (i: number): string =>
  SERIES_CLASS[
    ((i % SERIES_CLASS.length) + SERIES_CLASS.length) % SERIES_CLASS.length
  ]!;

// Buckets get fixed slots so NEEDS is the same colour in every chart. The order
// matches BUCKETS in lib/budget.ts.
export const BUCKET_SERIES: Record<Bucket, string> = {
  NEEDS: SERIES[0],
  WANTS: SERIES[1],
  SAVINGS: SERIES[2],
};

export const BUCKET_SERIES_CLASS: Record<Bucket, string> = {
  NEEDS: SERIES_CLASS[0],
  WANTS: SERIES_CLASS[1],
  SAVINGS: SERIES_CLASS[2],
};

// Direction, not category. --chart-1..5 is a categorical ramp with no green/red
// pair in it. These are dedicated fill tokens rather than the semantic
// --success-foreground / --error-foreground: those are tuned as text on a
// tinted chip, and at the scale of a full bar they read as stoplights.
// Used by income-vs-spend and the box in/out charts.
export const FLOW = {
  in: "var(--chart-flow-in)",
  out: "var(--chart-flow-out)",
} as const;

// Wash behind the region of a chart that is over budget.
export const OVER_BUDGET_FILL = "var(--chart-over-budget)";

export type Tone = "positive" | "negative" | "caution" | "neutral";

// Replaces the text-emerald-500 dark:text-emerald-400 / text-red-500 … pairs
// that were duplicated across the category and box cards.
export const TONE: Record<Tone, string> = {
  positive: "text-success-foreground",
  negative: "text-error-foreground",
  caution: "text-warning-foreground",
  neutral: "text-muted-foreground",
};

export const TONE_BG: Record<Tone, string> = {
  positive: "bg-success-foreground",
  negative: "bg-error-foreground",
  caution: "bg-warning-foreground",
  neutral: "bg-muted-foreground",
};

// Insight captions carry a "warning" tone; the visual vocabulary calls it
// "caution". One place to reconcile the two.
export function toneForInsight(
  tone: "positive" | "negative" | "neutral" | "warning",
): Tone {
  return tone === "warning" ? "caution" : tone;
}

// Percentage of budget spent -> the tone a meter or figure should carry.
export function toneForSpend(pct: number): Tone {
  if (pct >= 100) return "negative";
  if (pct >= 80) return "caution";
  return "positive";
}
