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

interface IncomeExpenseTrendChartProps {
  data: {
    month: string;
    income: number;
    spend: number;
    net: number;
  }[];
}

const chartConfig = {
  income: { label: "Income", color: "hsl(var(--chart-3))" },
  spend: { label: "Spending", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

export function IncomeExpenseTrendChart({ data }: IncomeExpenseTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Spending</CardTitle>
        <CardDescription>
          Monthly money in vs money out across all categories
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <Bar dataKey="income" name="Income" fill="#a3b18a" radius={4} />
            <Bar dataKey="spend" name="Spending" fill="#dba19b" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
