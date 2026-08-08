import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getAnalyticsData } from "@/lib/actions/analytics";
import { getBoxesContributionTrend } from "@/lib/actions/boxes";
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
import { BoxesTrendChart } from "../_components/boxes-trend-chart";
import { AnimatedNumber } from "@/components/animated-number";
import { formatMoney } from "@/lib/budget";
import {
    Stat,
    StatDescription,
    StatLabel,
    StatValue,
} from "@/components/ui/stat";
import { Meter } from "@/components/ui/meter";
import { TONE } from "@/lib/chart-palette";

export default async function Page() {
    const {
        monthlyTrend,
        incomeExpenseTrend,
        categoryBreakdown,
        topCategories,
        incomeThisMonth,
        spentThisMonth,
        netThisMonth,
        currency,
    } = await getAnalyticsData(6);

    const boxesTrend = await getBoxesContributionTrend(6);

    const currencyFormat = {
        style: "currency" as const,
        currency,
        trailingZeroDisplay: "stripIfInteger" as const,
    };

    return (
        <ContentLayout title="Analytics">
            <div className="flex flex-col gap-6 p-4 md:p-8 pt-6">
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Stat>
                        <StatLabel>Income This Month</StatLabel>
                        <StatValue className={TONE.positive}>
                            <AnimatedNumber value={incomeThisMonth} format={currencyFormat} />
                        </StatValue>
                        <StatDescription>money in this month</StatDescription>
                    </Stat>

                    <Stat>
                        <StatLabel>Spent This Month</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={spentThisMonth} format={currencyFormat} />
                        </StatValue>
                        <StatDescription>across all categories</StatDescription>
                    </Stat>

                    <Stat>
                        <StatLabel>Net This Month</StatLabel>
                        <StatValue
                            className={netThisMonth >= 0 ? TONE.positive : TONE.negative}
                        >
                            <AnimatedNumber
                                value={netThisMonth}
                                format={{ ...currencyFormat, signDisplay: "always" }}
                            />
                        </StatValue>
                        <StatDescription>
                            {netThisMonth >= 0 ? "saved this month" : "over budget this month"}
                        </StatDescription>
                    </Stat>
                </div>

                {/* Income vs spending trend */}
                <IncomeExpenseTrendChart data={incomeExpenseTrend} />

                {/* Monthly bucket trend */}
                <BucketTrendChart data={monthlyTrend} />

                {/* Box contributions trend */}
                <BoxesTrendChart data={boxesTrend} />

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
                                                        {formatMoney(c.value, currency)}
                                                    </span>
                                                </div>
                                                <Meter value={pct} label={`${c.name} share`} />
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
