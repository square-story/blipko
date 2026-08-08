"use client";

// Every active recurring rule, largest first.
//
// Horizontal because rule labels are free text and would be unreadable rotated
// under a vertical axis. Stacked with one key per kind so each renders in its
// own colour while every row stays a single bar — a rule is only ever one kind.

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { FLOW, SERIES } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import type { CommitmentRuleRow } from "@/lib/actions/analytics";

const KIND_LABEL = {
  INCOME: "Income",
  EXPENSE: "Charge",
  BOX: "To savings",
} as const;

const KIND_COLOR = {
  INCOME: FLOW.in,
  EXPENSE: FLOW.out,
  BOX: SERIES[2],
} as const;

export function CommitmentLoadChart({
  data,
  currency,
  locale,
}: {
  data: CommitmentRuleRow[];
  currency: string;
  locale: string;
}) {
  return (
    <BarChart
      data={data}
      xDataKey="label"
      orientation="horizontal"
      aspectRatio="3 / 2"
      // Category and rule names need room; the 40px default clips them.
      margin={{ left: 130 }}
    >
      <Grid vertical horizontal={false} />
      <Bar dataKey="INCOME" fill={KIND_COLOR.INCOME} />
      <Bar dataKey="EXPENSE" fill={KIND_COLOR.EXPENSE} />
      <Bar dataKey="BOX" fill={KIND_COLOR.BOX} />
      {/* Horizontal orientation puts the category axis on the left, so this is
          BarYAxis — BarXAxis would label the value axis along the bottom and
          the names would not line up with their bars. */}
      <BarYAxis />
      <ChartTooltip
        rows={(point) => {
          const kind = point.kind as keyof typeof KIND_LABEL;
          return [
            {
              color: KIND_COLOR[kind] ?? "var(--chart-1)",
              label: KIND_LABEL[kind] ?? "Recurring",
              value: formatMoney(Number(point.amount ?? 0), currency, locale),
            },
            {
              color: "var(--chart-foreground-muted)",
              label: "Due",
              value: `day ${point.cycleDay} of the cycle`,
            },
          ];
        }}
      />
    </BarChart>
  );
}
