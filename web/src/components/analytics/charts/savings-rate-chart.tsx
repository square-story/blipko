"use client";

// Share of income actually saved each cycle, against the user's own target.
//
// Two series on purpose. "Unspent" is whatever income was left over, which
// flatters you for a quiet month; "saved" counts money deliberately moved into
// the SAVINGS bucket or a box. The gap between them is the difference between
// underspending and saving.
//
// Cycles with no logged income have no rate at all. They are dropped from the
// series rather than plotted, because bklit's Line maps a non-number to pixel
// y=0 — a null would draw a spike to the top of the chart, and a zero would
// claim a 0% month that never happened. The x axis is a time scale, so the
// remaining points stay correctly spaced with the gap visible.

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ReferenceArea } from "@/components/charts/reference-area";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { SavingsRow } from "@/lib/actions/analytics";

const pct = (n: unknown) =>
  n === null || n === undefined ? "—" : `${Math.round(Number(n))}%`;

export function SavingsRateChart({
  data,
  targetPct,
}: {
  data: SavingsRow[];
  targetPct: number;
}) {
  const plotted = data.filter((d) => d.trueSavingsRatePct !== null);

  return (
    <LineChart data={plotted} xDataKey="cycleKey" aspectRatio="2 / 1">
      <Grid horizontal highlightRowValues={[0]} />
      {targetPct > 0 && (
        // y1 is the band's upper edge, so an omitted y2 shades down to the
        // bottom: everything below target.
        <ReferenceArea
          y1={targetPct}
          fill="var(--chart-segment-background)"
          fillOpacity={0.5}
          stroke="var(--chart-foreground-muted)"
          strokeStyle="dashed"
          showMarkers
        />
      )}
      <Line
        dataKey="trueSavingsRatePct"
        stroke="var(--chart-flow-in)"
        strokeWidth={2}
        showMarkers
      />
      <Line
        dataKey="unspentRatePct"
        stroke="var(--chart-foreground-muted)"
        strokeWidth={1.5}
        dashArray="4,4"
        dashFromIndex={0}
      />
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          {
            color: "var(--chart-flow-in)",
            label: "Saved",
            value: pct(point.trueSavingsRatePct),
          },
          {
            color: "var(--chart-foreground-muted)",
            label: "Unspent",
            value: pct(point.unspentRatePct),
          },
        ]}
      />
    </LineChart>
  );
}
