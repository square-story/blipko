"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { RoundedPieChart } from "@/components/ui/rounded-pie-chart";
import { ValueLineBarChart } from "@/components/ui/value-line-bar-chart";

interface VendorAnalyticsProps {
    spendingTrend: { date: string; amount: number }[];
    categoryStats: { name: string; value: number }[];
}

const COLORS = ["#074f8eff", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function VendorAnalytics({
    spendingTrend,
    categoryStats,
}: VendorAnalyticsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
            {/* AI Summary - Coming Soon */}
            <Card className="col-span-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-100 dark:border-indigo-900">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                        AI Insights
                    </CardTitle>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">Coming Soon</Badge>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">
                        AI-powered analysis of your spending habits with this vendor, including anomaly detection and budget recommendations.
                    </div>
                </CardContent>
            </Card>

            {/* Spending Trend Chart */}
            <ValueLineBarChart
                className="col-span-1 lg:col-span-4"
                title="Spending Trend"
                description="Your spending over time"
                data={spendingTrend}
                xKey="date"
                yKey="amount"
                chartConfig={{
                    amount: {
                        label: "Amount",
                        color: "var(--primary)",
                    },
                }}
            />

            {/* Category Distribution Chart - EvilCharts Style */}
            <RoundedPieChart
                className="col-span-1 lg:col-span-3"
                title="Category Distribution"
                chartData={categoryStats}
                description="Distribution by Category"
            />
        </div>
    );
}
