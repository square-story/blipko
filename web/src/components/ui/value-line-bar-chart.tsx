"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, XAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import React from "react";
import { AnimatePresence } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JetBrains_Mono } from "next/font/google";
import { useMotionValueEvent, useSpring, MotionValue } from "framer-motion";
import { AnimatedNumber } from "../animated-number";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const CHART_MARGIN = 35;

interface ValueLineBarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  title: string;
  description?: string;
  chartConfig?: ChartConfig;
  className?: string;
}

export function ValueLineBarChart({
  data,
  xKey,
  yKey,
  title,
  description,
  chartConfig = {},
  className,
}: ValueLineBarChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
  );

  const maxValueIndex = React.useMemo(() => {
    if (!data || data.length === 0) return { index: 0, value: 0 };
    // if user is moving mouse over bar then set value to the bar value
    if (activeIndex !== undefined) {
      return { index: activeIndex, value: Number(data[activeIndex][yKey]) };
    }
    // if no active index then set value to max value
    return data.reduce(
      (max, item, index) => {
        const value = Number(item[yKey]);
        return value > max.value ? { index, value } : max;
      },
      { index: 0, value: 0 }
    );
  }, [activeIndex, data, yKey]);

  const maxValueIndexSpring = useSpring(maxValueIndex.value, {
    stiffness: 100,
    damping: 20,
  }) as unknown as MotionValue<number>;

  const [springyValue, setSpringyValue] = React.useState(maxValueIndex.value);

  useMotionValueEvent(maxValueIndexSpring, "change", (latest: number) => {
    setSpringyValue(Number(latest.toFixed(0)));
  });

  React.useEffect(() => {
    maxValueIndexSpring.set(maxValueIndex.value);
  }, [maxValueIndex.value, maxValueIndexSpring]);

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={cn(jetBrainsMono.className, "text-2xl tracking-tighter")}>
              <AnimatedNumber value={springyValue} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
            </span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn(jetBrainsMono.className, "text-2xl tracking-tighter")}
          >
            <AnimatedNumber value={springyValue} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
          </span>
          <Badge variant="secondary">
            <TrendingUp className="h-4 w-4" />
            <span>{ }</span>
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                accessibilityLayer
                data={data}
                onMouseLeave={() => setActiveIndex(undefined)}
                margin={{
                  left: CHART_MARGIN,
                  right: CHART_MARGIN,
                }}
              >
                <XAxis
                  dataKey={xKey}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => {
                    // Handle date strings (YYYY-MM-DD)
                    if (typeof value === 'string') {
                      const date = new Date(value);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      }
                      return value.length > 3 ? value.slice(0, 3) : value;
                    }
                    return value;
                  }}
                />
                <Bar dataKey={yKey} fill="var(--color-primary)" radius={4}>
                  {data.map((_, index) => (
                    <Cell
                      className="duration-200"
                      opacity={index === maxValueIndex.index ? 1 : 0.2}
                      key={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      fill={index === maxValueIndex.index ? "var(--color-primary)" : "var(--color-primary)"}
                    />
                  ))}
                </Bar>
                <ReferenceLine
                  opacity={0.4}
                  y={springyValue}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  label={<CustomReferenceLabel value={maxValueIndex.value} />}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

interface CustomReferenceLabelProps {
  viewBox?: {
    x?: number;
    y?: number;
  };
  value: number;
}

const CustomReferenceLabel: React.FC<CustomReferenceLabelProps> = (props) => {
  const { viewBox, value } = props;
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;

  // we need to change width based on value length
  const width = React.useMemo(() => {
    const characterWidth = 8; // Average width of a character in pixels
    const padding = 10;
    return value.toString().length * characterWidth + padding;
  }, [value]);

  return (
    <>
      <rect
        x={x - CHART_MARGIN}
        y={y - 9}
        width={width}
        height={18}
        fill="var(--muted-foreground)"
        rx={4}
      />
      <text
        fontWeight={600}
        x={x - CHART_MARGIN + 6}
        y={y + 4}
        fill="var(--background)"
      >
        {value}
      </text>
    </>
  );
};
