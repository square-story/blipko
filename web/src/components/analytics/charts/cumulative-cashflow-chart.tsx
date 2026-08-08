"use client";

// Running total of net cashflow across the window.
//
// Per-cycle net answers "was this month good"; the cumulative line answers "am
// I ahead or behind overall", which is the question a budget tracker exists to
// answer and which nothing in the app showed before. Crossing zero is the
// event worth seeing.

import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { formatMoney } from "@/lib/budget";
import type { CashflowRow } from "@/lib/actions/analytics";

export function CumulativeCashflowChart({
  data,
  currency,
  locale,
}: {
  data: CashflowRow[];
  currency: string;
  locale: string;
}) {
  const money = (n: unknown) => formatMoney(Number(n ?? 0), currency, locale);
  const ending = data[data.length - 1]?.cumulative ?? 0;
  // Colour the whole series by where it ends up: ahead reads positive, behind
  // reads as a warning. A single series changing hue mid-line would be worse.
  const tone = ending >= 0 ? "var(--chart-flow-in)" : "var(--chart-flow-out)";

  return (
    <AreaChart data={data} xDataKey="cycleKey" aspectRatio="2 / 1">
      {/* highlightRowValues draws the zero baseline differently from the rest
          of the grid — above it you are ahead, below it you are behind. */}
      <Grid horizontal highlightRowValues={[0]} />
      <Area
        dataKey="cumulative"
        stroke={tone}
        fill={tone}
        fillOpacity={0.18}
        strokeWidth={2}
        showMarkers
      />
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          { color: tone, label: "Running total", value: money(point.cumulative) },
          {
            color: "var(--chart-foreground-muted)",
            label: "This cycle",
            value: money(point.net),
          },
        ]}
      />
    </AreaChart>
  );
}
