"use client";

// Money in versus money out per cycle.
//
// Replaces two near-identical recharts components — boxes-trend-chart on the
// analytics page and box-contribution-chart on the box detail page — which
// differed only in their card title and empty-state copy. Both of those are
// ChartCard's job now, so one chart serves both.
//
// In and out are directional rather than categorical, so they read through the
// semantic status tokens; --chart-1..5 is a categorical ramp with no green/red
// pair in it.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { FLOW } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";

// A type alias, not an interface: bklit's `data` prop is
// Record<string, unknown>[], and TypeScript only grants an implicit index
// signature to type aliases. Same reason every chart-facing row type in
// lib/actions/analytics.ts is declared with `type`.
export type InOutRow = {
  cycle: string;
  in: number;
  out: number;
};

export function InOutBarChart({
  data,
  inLabel = "In",
  outLabel = "Out",
  currency,
  locale,
}: {
  data: InOutRow[];
  inLabel?: string;
  outLabel?: string;
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    <BarChart data={data} xDataKey="cycle" aspectRatio="2 / 1">
      <Grid horizontal />
      <Bar dataKey="in" fill={FLOW.in} />
      <Bar dataKey="out" fill={FLOW.out} />
      <BarXAxis />
      <ChartTooltip
        rows={(point) => [
          { color: FLOW.in, label: inLabel, value: money(point.in) },
          { color: FLOW.out, label: outLabel, value: money(point.out) },
        ]}
      />
    </BarChart>
  );
}
