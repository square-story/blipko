"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Legend } from "recharts";
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

interface BoxesTrendChartProps {
  data: { month: string; in: number; out: number }[];
}

const chartConfig = {
  in: { label: "Added", color: "hsl(var(--chart-3))" },
  out: { label: "Spent", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

// Aggregate box contributions/withdrawals across all boxes (analytics page).
export function BoxesTrendChart({ data }: BoxesTrendChartProps) {
  const hasActivity = data.some((d) => d.in > 0 || d.out > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Box Contributions</CardTitle>
        <CardDescription>
          Money added to vs taken from your boxes, by month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
              <Legend />
              <Bar dataKey="in" name="Added" fill="#a3b18a" radius={4} />
              <Bar dataKey="out" name="Spent" fill="#dba19b" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No box activity yet — move a transaction into a box to see the trend.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
