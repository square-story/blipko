import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getAnalyticsData } from "@/lib/actions/analytics";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { RoundedPieChart } from "@/components/ui/rounded-pie-chart";
import { BucketTrendChart } from "../_components/income-expense-chart";
import { IncomeExpenseTrendChart } from "../_components/income-expense-trend-chart";
import { formatMoney } from "@/lib/budget";

export default async function Page() {
    const {
        monthlyTrend,
        incomeExpenseTrend,
        categoryBreakdown,
        topCategories,
        incomeThisMonth,
        spentThisMonth,
        netThisMonth,
    } = await getAnalyticsData(6);

    return (
        <ContentLayout title="Analytics">
            <div className="flex flex-col gap-6 p-4 md:p-8 pt-6">
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Income This Month</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatMoney(incomeThisMonth)}
                            </div>
                            <p className="text-xs text-muted-foreground">money in this month</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Spent This Month</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatMoney(spentThisMonth)}</div>
                            <p className="text-xs text-muted-foreground">across all categories</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Net This Month</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`text-2xl font-bold ${netThisMonth >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                                {netThisMonth >= 0 ? "+" : "−"}
                                {formatMoney(Math.abs(netThisMonth))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {netThisMonth >= 0 ? "saved this month" : "over budget this month"}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Income vs spending trend */}
                <IncomeExpenseTrendChart data={incomeExpenseTrend} />

                {/* Monthly bucket trend */}
                <BucketTrendChart data={monthlyTrend} />

                {/* Category pie + top categories */}
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    <RoundedPieChart
                        title="Spend by Category"
                        description="Current month breakdown"
                        chartData={categoryBreakdown}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Categories</CardTitle>
                            <CardDescription>Highest spend this month</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {topCategories.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No spend yet this month.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {topCategories.map((c) => {
                                        const max = topCategories[0]?.value ?? 1;
                                        const pct = Math.round((c.value / max) * 100);
                                        return (
                                            <div key={c.name} className="space-y-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium">{c.name}</span>
                                                    <span className="text-muted-foreground">
                                                        {formatMoney(c.value)}
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-muted">
                                                    <div
                                                        className="h-2 rounded-full bg-primary"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ContentLayout>
    );
}
