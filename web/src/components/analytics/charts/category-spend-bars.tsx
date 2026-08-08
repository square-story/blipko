"use client";

// Spend per budget cycle for one category, with the monthly limit shaded.
//
// The recharts version drew a bare dashed ReferenceLine at the limit. bklit has
// no single-value reference line, but ReferenceArea with y1 and no y2 extends
// to the top of the plot, which shades the overspend zone instead of drawing a
// line you have to interpret — strictly more readable.

import type { Bucket } from "@prisma/client";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ReferenceArea } from "@/components/charts/reference-area";
import { ChartTooltip } from "@/components/charts/tooltip";
import { BUCKET_SERIES, OVER_BUDGET_FILL } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";

export interface CategorySpendBarsProps {
  data: { label: string; spend: number }[];
  bucket: Bucket;
  budget: number | null;
  currency: string;
  locale: string;
}

export function CategorySpendBars({
  data,
  bucket,
  budget,
  currency,
  locale,
}: CategorySpendBarsProps) {
  const hasBudget = budget != null && budget > 0;
  const fill = BUCKET_SERIES[bucket];

  return (
    <BarChart data={data} xDataKey="label" aspectRatio="2 / 1">
      <Grid horizontal />
      {hasBudget && (
        // y2 is the band's lower edge and an omitted y1 extends to the top of
        // the plot, so this shades everything ABOVE the limit. Using y1 here
        // instead shades the region under the limit, which is backwards — the
        // point is to mark the overspend zone.
        <ReferenceArea
          y2={budget}
          stroke="var(--chart-foreground-muted)"
          strokeStyle="dashed"
          fill={OVER_BUDGET_FILL}
          fillOpacity={1}
          showMarkers
        />
      )}
      <Bar dataKey="spend" fill={fill} />
      <BarXAxis />
      <ChartTooltip
        rows={(point) => [
          {
            color: fill,
            label: "Spent",
            value: formatMoney(Number(point.spend ?? 0), currency, locale),
          },
        ]}
      />
    </BarChart>
  );
}
