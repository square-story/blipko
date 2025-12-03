"use client";

import { LabelList, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

interface RoundedPieChartProps {
  title: string;
  chartData: { name: string; value: number }[];
  description: string;
  className?: string;
}

export function RoundedPieChart({
  title,
  chartData,
  description,
  className,
}: RoundedPieChartProps) {
  // Generate config and data format expected by the chart
  const config = chartData.reduce((acc, curr, index) => {
    acc[curr.name] = {
      label: curr.name,
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const formattedData = chartData.map((stat, index) => ({
    browser: stat.name,
    visitors: stat.value,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2">
          {title}
          {/* Placeholder for future growth stat */}
          {/* <Badge
            variant="outline"
            className="text-green-500 bg-green-500/10 border-none ml-2"
          >
            <TrendingUp className="h-4 w-4" />
            <span>5.2%</span>
          </Badge> */}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {chartData.length > 0 ? (
          <ChartContainer
            config={config}
            className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="browser" hideLabel />}
              />
              <Pie
                data={formattedData}
                innerRadius={20}
                dataKey="visitors"
                radius={120}
                cornerRadius={8}
                paddingAngle={4}
              >
                <LabelList
                  dataKey="browser"
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                  formatter={(value: any) => config[value as string]?.label}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
