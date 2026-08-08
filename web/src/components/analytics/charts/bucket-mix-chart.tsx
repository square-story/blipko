"use client";

// Needs, wants and savings per cycle.
//
// Grouped, not stacked. Stacking would read better here — the question is what
// share of a cycle went where — but bklit derives the y-domain for a stacked
// bar chart from the largest single series rather than the largest stack, so
// the upper segments render above the top of the plot and spill out of the
// card. Measured: three segments of 3900/2000/4450 scaled to a domain of 4450.
// Grouped bars are correct by construction, and the tooltip still gives the
// per-cycle total.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { BUCKET_SERIES } from "@/lib/chart-palette";
import { BUCKETS, BUCKET_META, formatMoney } from "@/lib/budget";
import type { BucketTrendRow } from "@/lib/actions/analytics";

export function BucketMixChart({
  data,
  currency,
  locale,
}: {
  data: BucketTrendRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    <BarChart data={data} xDataKey="cycle" aspectRatio="2 / 1">
      <Grid horizontal />
      {/* Written out rather than mapped over BUCKETS so the series order is
          fixed and readable at a glance. */}
      <Bar dataKey="NEEDS" fill={BUCKET_SERIES.NEEDS} />
      <Bar dataKey="WANTS" fill={BUCKET_SERIES.WANTS} />
      <Bar dataKey="SAVINGS" fill={BUCKET_SERIES.SAVINGS} />
      <BarXAxis />
      <ChartTooltip
        rows={(point) => [
          ...BUCKETS.map((b) => ({
            color: BUCKET_SERIES[b],
            label: BUCKET_META[b].label,
            value: money(point[b]),
          })),
          {
            color: "var(--chart-foreground-muted)",
            label: "Total",
            value: money(point.total),
          },
        ]}
      />
    </BarChart>
  );
}
