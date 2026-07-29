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
import { BUCKET_META } from "@/lib/budget";

interface BucketTrendChartProps {
    data: {
        month: string;
        NEEDS: number;
        WANTS: number;
        SAVINGS: number;
    }[];
}

const chartConfig = {
    NEEDS: { label: BUCKET_META.NEEDS.label, color: "var(--chart-needs)" },
    WANTS: { label: BUCKET_META.WANTS.label, color: "var(--chart-wants)" },
    SAVINGS: { label: BUCKET_META.SAVINGS.label, color: "var(--chart-savings)" },
} satisfies ChartConfig;

export function BucketTrendChart({ data }: BucketTrendChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Spending by Bucket</CardTitle>
                <CardDescription>Monthly breakdown across Needs, Wants, and Savings</CardDescription>
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
                        <Bar dataKey="NEEDS" fill="var(--color-NEEDS)" radius={4} />
                        <Bar dataKey="WANTS" fill="var(--color-WANTS)" radius={4} />
                        <Bar dataKey="SAVINGS" fill="var(--color-SAVINGS)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
