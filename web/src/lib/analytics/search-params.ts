// URL state for the analytics page.
//
// The same parser objects are used by the server loader and by the client
// controls, so their defaults cannot drift apart.

import {
  createLoader,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

export const ANALYTICS_TABS = [
  "overview",
  "cashflow",
  "categories",
  "commitments",
  "habits",
] as const;

export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

// Which tabs the cycle range actually reaches. Categories reads only the
// current and previous cycle, Commitments only the current one — offering the
// control there costs a server round trip and a loading flash to redraw
// identical charts, which reads as a broken control rather than a no-op.
export const RANGE_AWARE_TABS: readonly AnalyticsTab[] = [
  "overview",
  "cashflow",
  "habits",
];

export const CYCLE_RANGES = [3, 6, 12] as const;
export const DEFAULT_RANGE = 6;

export const analyticsParams = {
  tab: parseAsStringLiteral(ANALYTICS_TABS).withDefault("overview"),
  range: parseAsInteger.withDefault(DEFAULT_RANGE),
};

export const loadAnalyticsParams = createLoader(analyticsParams);

// The actions clamp to 1..12 already, but a hand-typed ?range=7 would still
// produce a chart nobody designed. Snap to an offered value.
export function normalizeRange(value: number): number {
  return (CYCLE_RANGES as readonly number[]).includes(value)
    ? value
    : DEFAULT_RANGE;
}
