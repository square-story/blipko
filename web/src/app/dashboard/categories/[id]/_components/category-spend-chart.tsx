"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
} from "recharts";
import type { Bucket } from "@prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface CategorySpendChartProps {
  data: { label: string; spend: number }[];
  bucket: Bucket;
  budget: number | null;
}

const BUCKET_COLOR: Record<Bucket, string> = {
  NEEDS: "var(--chart-needs)",
  WANTS: "var(--chart-wants)",
  SAVINGS: "var(--chart-savings)",
};

export function CategorySpendChart({
  data,
  bucket,
  budget,
}: CategorySpendChartProps) {
  const hasActivity = data.some((d) => d.spend > 0);
  const hasBudget = budget != null && budget > 0;
  const chartConfig = {
    spend: { label: "Spent", color: BUCKET_COLOR[bucket] },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend over time</CardTitle>
        <CardDescription>
          This category per budget cycle
          {hasBudget ? " — dashed line is the monthly limit" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="dashed" />}
              />
              {hasBudget && (
                <ReferenceLine
                  y={budget}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeDasharray="4 4"
                />
              )}
              <Bar
                dataKey="spend"
                name="Spent"
                fill="var(--color-spend)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No spend recorded yet in this category.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
