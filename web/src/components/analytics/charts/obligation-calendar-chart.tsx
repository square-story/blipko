"use client";

// Where recurring charges land inside the budget cycle.
//
// The x axis is the day of the CYCLE, not the day of the month. Recurring rules
// fire on calendar dates while the budget runs payday to payday, so a rule on
// the 5th under a payday of 25 lands on cycle day 12. Plotting it by day of
// month would put the obligations in the wrong order relative to when the money
// arrives — which is the entire question this chart answers.
//
// Not the heatmap component: that is a weekday-by-week contributions grid, so a
// 1-31 run would need fabricated dates and a mislabelled y axis.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { FLOW, SERIES } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import type { ObligationRow } from "@/lib/actions/analytics";

export function ObligationCalendarChart({
  data,
  currency,
  locale,
}: {
  data: ObligationRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    // Not stacked: bklit sizes a stacked domain from the largest single series,
    // so any day carrying more than one kind would overflow the plot. Most days
    // have a single kind anyway.
    <BarChart data={data} xDataKey="cycleDay" aspectRatio="3 / 1">
      <Grid horizontal />
      <Bar dataKey="income" fill={FLOW.in} />
      <Bar dataKey="expense" fill={FLOW.out} />
      <Bar dataKey="box" fill={SERIES[2]} />
      <BarXAxis maxLabels={8} />
      <ChartTooltip
        rows={(point) => {
          const rows: { color: string; label: string; value: string }[] = [];
          if (Number(point.income ?? 0) > 0) {
            rows.push({ color: FLOW.in, label: "Income", value: money(point.income) });
          }
          if (Number(point.expense ?? 0) > 0) {
            rows.push({ color: FLOW.out, label: "Charges", value: money(point.expense) });
          }
          if (Number(point.box ?? 0) > 0) {
            rows.push({ color: SERIES[2], label: "To savings", value: money(point.box) });
          }
          if (rows.length === 0) {
            rows.push({
              color: "var(--chart-foreground-muted)",
              label: `Day ${point.cycleDay}`,
              value: "nothing due",
            });
          }
          return rows;
        }}
      />
    </BarChart>
  );
}
