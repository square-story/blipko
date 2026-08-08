"use client";

// Which categories moved most against the previous cycle.
//
// Two data keys rather than one signed value: bklit's Bar takes a single fill,
// so increases and decreases need separate series to be coloured differently.
// Rows carry 0 in whichever side does not apply, which renders nothing.
//
// Both series are positive magnitudes. Bar length is how much changed and
// colour is the direction — red for spending more, green for less. A signed
// value would mean a negative SVG rect width, which browsers reject.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { FLOW } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import type { CategoryMoverRow } from "@/lib/actions/analytics";

export function CategoryMoversChart({
  data,
  currency,
  locale,
}: {
  data: CategoryMoverRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);

  return (
    <BarChart
      data={data}
      xDataKey="name"
      orientation="horizontal"
      aspectRatio="3 / 2"
      // Category and rule names need room; the 40px default clips them.
      margin={{ left: 130 }}
    >
      <Grid vertical horizontal={false} highlightRowValues={[0]} />
      <Bar dataKey="increase" fill={FLOW.out} />
      <Bar dataKey="decrease" fill={FLOW.in} />
      {/* Horizontal orientation puts the category axis on the left, so this is
          BarYAxis — BarXAxis would label the value axis along the bottom and
          the names would not line up with their bars. */}
      <BarYAxis />
      <ChartTooltip
        rows={(point) => {
          const delta = Number(point.delta ?? 0);
          const pct = point.deltaPct;
          return [
            {
              color: delta > 0 ? FLOW.out : FLOW.in,
              label: delta > 0 ? "More than last cycle" : "Less than last cycle",
              value:
                money(Math.abs(delta)) +
                (pct === null || pct === undefined
                  ? ""
                  : ` (${Math.abs(Math.round(Number(pct)))}%)`),
            },
            {
              color: "var(--chart-foreground-muted)",
              label: "This cycle",
              value: money(point.current),
            },
            {
              color: "var(--chart-foreground-muted)",
              label: "Last cycle",
              value: money(point.previous),
            },
          ];
        }}
      />
    </BarChart>
  );
}
