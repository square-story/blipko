"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface IncomeExpenseChartProps {
    data: {
        date: string;
        income: number;
        expense: number;
    }[];
}

const chartConfig = {
    income: {
        label: "Income",
        color: "hsl(var(--chart-1))",
    },
    expense: {
        label: "Expense",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Income vs Expense</CardTitle>
                <CardDescription>Daily breakdown for the current month</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart accessibilityLayer data={data}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                            }}
                        />
                        <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                        <Legend />
                        <Bar dataKey="income" fill="#829496" radius={4} />
                        <Bar dataKey="expense" fill="#dba19b" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
