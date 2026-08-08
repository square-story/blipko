"use client";

// Spend so far this cycle against the pace that would land exactly on budget.
//
// This is the one chart that answers "can I keep spending like this", which
// categoryPacing has been able to compute all along but was only ever applied
// to a single category.
//
// One spend line, not two: solid through today, dashed for the forecast. That
// is also the only shape that works here — bklit's Line maps any non-number to
// pixel y=0, so a null-gapped series draws a spike to the top of the plot
// instead of a break.

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ReferenceArea } from "@/components/charts/reference-area";
import { ChartTooltip } from "@/components/charts/tooltip";
import { OVER_BUDGET_FILL } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import type { BurnDownRow } from "@/lib/actions/analytics";

export function BurnDownChart({
  data,
  budget,
  currency,
  locale,
}: {
  data: BurnDownRow[];
  budget: number | null;
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);
  const hasBudget = budget !== null && budget > 0;
  // Index of the first forecast point — everything from here renders dashed.
  const forecastFrom = data.findIndex((d) => d.isForecast);

  return (
    <LineChart data={data} xDataKey="dateLabel" aspectRatio="2 / 1">
      <Grid horizontal />
      {hasBudget && (
        <ReferenceArea
          y2={budget}
          fill={OVER_BUDGET_FILL}
          fillOpacity={1}
          stroke="var(--chart-foreground-muted)"
          strokeStyle="dashed"
          showMarkers
        />
      )}
      {hasBudget && (
        <Line
          dataKey="ideal"
          stroke="var(--chart-foreground-muted)"
          strokeWidth={1.5}
          dashArray="4,4"
          dashFromIndex={0}
        />
      )}
      <Line
        dataKey="spent"
        stroke="var(--chart-1)"
        strokeWidth={2.5}
        dashArray="6,4"
        dashFromIndex={forecastFrom >= 0 ? forecastFrom : undefined}
      />
      <XAxis />
      <ChartTooltip
        rows={(point) => {
          const rows = [
            {
              color: "var(--chart-1)",
              label: point.isForecast ? "At this rate" : "Spent so far",
              value: money(point.spent),
            },
          ];
          if (hasBudget) {
            rows.push({
              color: "var(--chart-foreground-muted)",
              label: "On-budget pace",
              value: money(point.ideal),
            });
          }
          return rows;
        }}
      />
    </LineChart>
  );
}
