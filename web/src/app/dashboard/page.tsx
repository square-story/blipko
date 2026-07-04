import { Suspense, type CSSProperties } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getBudgetOverview } from "@/lib/actions/budget";
import { getOnboardingTaxonomy } from "@/lib/actions/onboarding";
import { getNeedsReviewExpenses } from "@/lib/actions/expenses";
import { getCategories } from "@/lib/actions/categories";
import { NeedsReviewInbox } from "./_components/needs-review-inbox";
import {
    Stat,
    StatLabel,
    StatValue,
    StatDescription,
    StatIndicator,
} from "@/components/ui/stat";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { AnimatedNumber } from "@/components/animated-number";
import Onboarding from "@/components/onboarding";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { BUCKET_META, formatMoney } from "@/lib/budget";

async function OverviewSection({
    overviewPromise,
}: {
    overviewPromise: ReturnType<typeof getBudgetOverview>;
}) {
    const {
        monthlyIncome,
        expectedIncome,
        incomeThisMonth,
        periodLabel,
        currency,
        buckets,
        totalSpent,
        savingsProgress,
        recentExpenses,
        categoryBreakdown,
        hasOnboarded,
    } = await overviewPromise;

    const taxonomy = hasOnboarded ? [] : await getOnboardingTaxonomy();
    const needsReviewPromise = getNeedsReviewExpenses();
    const categoriesPromise = getCategories();

    const [needsReview, categories] = await Promise.all([
        needsReviewPromise,
        categoriesPromise
    ]);

    const currencyFormat = {
        style: "currency" as const,
        currency,
        trailingZeroDisplay: "stripIfInteger" as const,
    };

    return (
        <>
            {!hasOnboarded && <Onboarding taxonomy={taxonomy} />}
            
            <NeedsReviewInbox 
                expenses={needsReview} 
                categories={categories} 
                currency={currency} 
            />

            {/* Headline stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Stat className="reveal-rise">
                    <StatLabel>Income This Cycle</StatLabel>
                    <StatValue>
                        <AnimatedNumber value={incomeThisMonth} format={currencyFormat} />
                    </StatValue>
                    <StatDescription>
                        Logged this cycle · budget on {formatMoney(monthlyIncome, currency)}
                        {monthlyIncome > incomeThisMonth
                            ? ` (expected ${formatMoney(expectedIncome, currency)})`
                            : ""}
                    </StatDescription>
                    <StatIndicator color="success">
                        <Wallet className="h-4 w-4" />
                    </StatIndicator>
                </Stat>

                <Stat className="reveal-rise" style={{ animationDelay: "40ms" }}>
                    <StatLabel>Spent This Cycle</StatLabel>
                    <StatValue>
                        <AnimatedNumber value={totalSpent} format={currencyFormat} />
                    </StatValue>
                    <StatDescription>{periodLabel}</StatDescription>
                    <StatIndicator color="warning">
                        <TrendingDown className="h-4 w-4" />
                    </StatIndicator>
                </Stat>

                <Stat className="reveal-rise" style={{ animationDelay: "80ms" }}>
                    <StatLabel>Savings This Month</StatLabel>
                    <StatValue>
                        <AnimatedNumber value={savingsProgress.saved} format={currencyFormat} />
                    </StatValue>
                    <StatDescription>
                        {savingsProgress.pct}% of {formatMoney(savingsProgress.target, currency)} target
                    </StatDescription>
                    <StatIndicator color="success">
                        <PiggyBank className="h-4 w-4" />
                    </StatIndicator>
                </Stat>
            </div>

            {/* Bucket cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {buckets.map((b, i) => {
                    const meta = BUCKET_META[b.bucket];
                    const over = b.pct > 100;
                    const barWidth = Math.min(100, b.pct);
                    return (
                        <Card
                            key={b.bucket}
                            className="reveal-rise"
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span>
                                        {meta.emoji} {meta.label}
                                    </span>
                                    <span
                                        className={`text-sm font-medium ${over ? "text-destructive" : "text-muted-foreground"}`}
                                    >
                                        {b.pct}%
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-sm">
                                    <span className="font-semibold">
                                        {formatMoney(b.spent, currency)}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                        / {formatMoney(b.budget, currency)}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted">
                                    <div
                                        className={`bar-fill h-2 w-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                                        style={{ "--pct": barWidth / 100 } as CSSProperties}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {b.remaining >= 0
                                        ? `${formatMoney(b.remaining, currency)} left`
                                        : `${formatMoney(Math.abs(b.remaining), currency)} over`}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Recent expenses + category breakdown */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Card className="reveal-rise">
                    <CardHeader>
                        <CardTitle>Recent Expenses</CardTitle>
                        <CardDescription>Latest spends this month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentExpenses.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No expenses logged yet this month.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentExpenses.map((e) => (
                                    <div
                                        key={e.id}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="shrink-0">
                                                    {BUCKET_META[e.bucket].emoji}
                                                </span>
                                                <span className="truncate text-sm font-medium">
                                                    {e.categoryName ?? BUCKET_META[e.bucket].label}
                                                </span>
                                            </div>
                                            {e.note && (
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {e.note}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-medium">
                                                {formatMoney(e.amount, currency)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(e.date), "MMM d")}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="reveal-rise" style={{ animationDelay: "40ms" }}>
                    <CardHeader>
                        <CardTitle>Top Categories</CardTitle>
                        <CardDescription>Where your money went this month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {categoryBreakdown.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No category spend yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {categoryBreakdown.slice(0, 6).map((c) => {
                                    const max = categoryBreakdown[0].value || 1;
                                    const pct = Math.round((c.value / max) * 100);
                                    return (
                                        <div key={c.name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{c.name}</span>
                                                <span className="text-muted-foreground">
                                                    {formatMoney(c.value, currency)}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-muted">
                                                <div
                                                    className="bar-fill h-2 w-full rounded-full bg-primary"
                                                    style={{ "--pct": pct / 100 } as CSSProperties}
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
        </>
    );
}

export default function Page() {
    const overviewPromise = getBudgetOverview();

    return (
        <ContentLayout title="Dashboard">
            <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
                <Suspense
                    fallback={
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-xl" />
                            ))}
                        </div>
                    }
                >
                    <OverviewSection overviewPromise={overviewPromise} />
                </Suspense>
            </div>
        </ContentLayout>
    );
}
