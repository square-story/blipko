"use client";

// Income and spend per cycle as bars, with net as a line over the top.
//
// The recharts version typed a `net` field and never rendered it; the number
// people actually care about was in the payload and invisible. ComposedChart
// puts it on the same axis as the bars it is derived from.
//
// x is cycleKey ("YYYY-MM-DD"), not the display label: the composed chart runs
// on a time scale and coerces x with new Date().

import { ComposedChart } from "@/components/charts/composed-chart";
import { SeriesBar } from "@/components/charts/series-bar";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { FLOW } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import type { CashflowRow } from "@/lib/actions/analytics";

export function IncomeVsSpendChart({
  data,
  currency,
  locale,
}: {
  data: CashflowRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    // maxBarSize matters here: a composed chart runs on a time scale, not a
    // band scale, so with only a few cycles the bars size themselves off the
    // time domain and each one ends up hundreds of pixels wide.
    <ComposedChart
      data={data}
      xDataKey="cycleKey"
      aspectRatio="2 / 1"
      maxBarSize={48}
    >
      <Grid horizontal />
      <SeriesBar dataKey="income" fill={FLOW.in} />
      <SeriesBar dataKey="spend" fill={FLOW.out} />
      <Line dataKey="net" stroke="var(--chart-1)" strokeWidth={2} showMarkers />
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          { color: FLOW.in, label: "Income", value: money(point.income) },
          { color: FLOW.out, label: "Spent", value: money(point.spend) },
          { color: "var(--chart-1)", label: "Net", value: money(point.net) },
        ]}
      />
    </ComposedChart>
  );
}
