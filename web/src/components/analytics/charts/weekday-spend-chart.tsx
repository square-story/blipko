"use client";

// Spend by day of the week, split by bucket.
//
// Weekday comes from the user's timezone, not the server's — on UTC infra a
// 01:00 IST purchase would otherwise be filed under the previous day, which is
// exactly the kind of quiet error that makes a habits chart worse than useless.
//
// Monday first: a spending week reads better ending on the weekend than
// starting with half of it.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { BUCKET_SERIES } from "@/lib/chart-palette";
import { BUCKETS, BUCKET_META, formatMoney } from "@/lib/budget";
import type { WeekdayRow } from "@/lib/actions/analytics";

export function WeekdaySpendChart({
  data,
  currency,
  locale,
}: {
  data: WeekdayRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    <BarChart data={data} xDataKey="weekday" aspectRatio="2 / 1">
      <Grid horizontal />
      {/* Grouped rather than stacked for the same reason as bucket-mix-chart:
          bklit sizes a stacked bar chart's y-domain from the largest single
          series, so stacks overflow the plot. */}
      <Bar dataKey="NEEDS" fill={BUCKET_SERIES.NEEDS} />
      <Bar dataKey="WANTS" fill={BUCKET_SERIES.WANTS} />
      <Bar dataKey="SAVINGS" fill={BUCKET_SERIES.SAVINGS} />
      <BarXAxis showAllLabels />
      <ChartTooltip
        rows={(point) => [
          {
            color: "var(--chart-foreground-muted)",
            label: "Total",
            value: money(point.total),
          },
          ...BUCKETS.filter((b) => Number(point[b] ?? 0) > 0).map((b) => ({
            color: BUCKET_SERIES[b],
            label: BUCKET_META[b].label,
            value: money(point[b]),
          })),
          {
            color: "var(--chart-foreground-muted)",
            label: "Transactions",
            value: String(point.txnCount ?? 0),
          },
        ]}
      />
    </BarChart>
  );
}
