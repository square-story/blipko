import { Suspense } from "react";
import Link from "next/link";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getBudgetOverview } from "@/lib/actions/budget";
import { getOnboardingTaxonomy } from "@/lib/actions/onboarding";
import { getNeedsReviewExpenses } from "@/lib/actions/expenses";
import { getCategories } from "@/lib/actions/categories";
import { getBoxes } from "@/lib/actions/boxes";
import { getWrappedStats } from "@/lib/actions/wrapped";
import { NeedsReviewInbox } from "./_components/needs-review-inbox";
import { WrappedLauncher } from "./_components/wrapped-launcher";
import { BoxesSummaryCard } from "./_components/boxes-summary-card";
import { ConnectTelegramBanner } from "@/components/connect-telegram-banner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { AnimatedNumber } from "@/components/animated-number";
import Onboarding from "@/components/onboarding";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingDown, Scale, ArrowRight } from "lucide-react";
import { BUCKET_META, formatMoney } from "@/lib/budget";
import { Meter, MeterStrip } from "@/components/ui/meter";
import { TONE, seriesClass } from "@/lib/chart-palette";

// Cards that navigate: the Link is the grid item, so it carries the reveal
// animation and the hover/focus affordance.
const CARD_LINK =
    "reveal-rise transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>*]:h-full [&>*]:transition-colors hover:[&>*]:border-primary/40";

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
        balance,
        cycleFrom,
        cycleTo,
        recentExpenses,
        categoryBreakdown,
        hasOnboarded,
    } = await overviewPromise;

    const taxonomy = hasOnboarded ? [] : await getOnboardingTaxonomy();
    const needsReviewPromise = getNeedsReviewExpenses();
    const categoriesPromise = getCategories();

    const [needsReview, categories, boxes, wrapped] = await Promise.all([
        needsReviewPromise,
        categoriesPromise,
        getBoxes(),
        getWrappedStats(),
    ]);

    const currencyFormat = {
        style: "currency" as const,
        currency,
        trailingZeroDisplay: "stripIfInteger" as const,
    };

    // Transaction links stay scoped to the cycle the cards are reporting on.
    const cycleQs = new URLSearchParams({
        from: String(cycleFrom),
        to: String(cycleTo),
    }).toString();

    return (
        <>
            {!hasOnboarded && <Onboarding taxonomy={taxonomy} />}
            {hasOnboarded && <ConnectTelegramBanner />}
            {hasOnboarded && <WrappedLauncher stats={wrapped} />}

            <NeedsReviewInbox
                expenses={needsReview} 
                categories={categories} 
                currency={currency} 
            />

            {/* Headline stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href={`/dashboard/income?${cycleQs}`} className={`${CARD_LINK} rounded-lg`}>
                    <Stat>
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
                </Link>

                <Link
                    href={`/dashboard/expenses?${cycleQs}`}
                    className={`${CARD_LINK} rounded-lg`}
                    style={{ animationDelay: "40ms" }}
                >
                    <Stat>
                        <StatLabel>Spent This Cycle</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={totalSpent} format={currencyFormat} />
                        </StatValue>
                        <StatDescription>{periodLabel}</StatDescription>
                        <StatIndicator color="warning">
                            <TrendingDown className="h-4 w-4" />
                        </StatIndicator>
                    </Stat>
                </Link>

                <Link
                    href="/dashboard/analytics"
                    className={`${CARD_LINK} rounded-lg`}
                    style={{ animationDelay: "80ms" }}
                >
                    <Stat>
                        <StatLabel>Balance This Cycle</StatLabel>
                        <StatValue className={balance < 0 ? "text-destructive" : undefined}>
                            <AnimatedNumber value={balance} format={currencyFormat} />
                        </StatValue>
                        <StatDescription>
                            {formatMoney(incomeThisMonth, currency)} in − {formatMoney(totalSpent, currency)} out
                        </StatDescription>
                        <StatIndicator color={balance < 0 ? "error" : "success"}>
                            <Scale className="h-4 w-4" />
                        </StatIndicator>
                    </Stat>
                </Link>
            </div>

            {/* Bucket cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {buckets.map((b, i) => {
                    const meta = BUCKET_META[b.bucket];
                    const isSavings = b.bucket === "SAVINGS";
                    // Savings: beating the target is a win, not a warning.
                    const savingsWin = isSavings && b.spent >= b.budget && b.budget > 0;
                    const overspent = !isSavings && b.pct > 100;
                    const barWidth = Math.min(100, b.pct);
                    return (
                        <Link
                            key={b.bucket}
                            href={`/dashboard/categories?bucket=${b.bucket}`}
                            className={`${CARD_LINK} rounded-xl`}
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center justify-between text-base">
                                        <span>
                                            {meta.emoji} {meta.label}
                                        </span>
                                        <span
                                            className={`text-sm font-medium ${overspent ? "text-destructive" : savingsWin ? TONE.positive : "text-muted-foreground"}`}
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
                                    <Meter
                                        value={barWidth}
                                        tone={overspent ? "negative" : savingsWin ? "positive" : "primary"}
                                        animate
                                        label={`${meta.label} budget used`}
                                    />
                                    <p className={`text-xs ${savingsWin ? TONE.positive : "text-muted-foreground"}`}>
                                        {isSavings
                                            ? b.remaining < 0
                                                ? `🎉 ${formatMoney(Math.abs(b.remaining), currency)} above target`
                                                : b.remaining === 0
                                                    ? "🎉 Target reached"
                                                    : `${formatMoney(b.remaining, currency)} to go`
                                            : b.remaining >= 0
                                                ? `${formatMoney(b.remaining, currency)} left`
                                                : `${formatMoney(Math.abs(b.remaining), currency)} over`}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
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

                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="mt-4 h-auto px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                        >
                            <Link href={`/dashboard/expenses?${cycleQs}`}>
                                View all transactions
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Link
                    href="/dashboard/analytics"
                    className="reveal-rise rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ animationDelay: "40ms" }}
                >
                    <Card className="h-full transition-colors hover:border-primary/40">
                        <CardContent className="flex h-full flex-col justify-between pt-6">
                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-balance text-sm font-bold text-foreground">Top Categories</h3>
                                    <Badge
                                        variant="secondary"
                                        className="bg-amber-50 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20"
                                    >
                                        This Month
                                    </Badge>
                                </div>

                                <p className="text-pretty mt-2 flex items-baseline gap-2">
                                    <span className="text-xl text-foreground">{formatMoney(totalSpent, currency)}</span>
                                    <span className="text-sm text-muted-foreground">total spent</span>
                                </p>

                                {categoryBreakdown.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        No category spend yet.
                                    </p>
                                ) : (
                                    <>
                                        <div className="mt-4">
                                            <p className="text-pretty text-sm font-medium text-foreground">
                                                Category breakdown
                                            </p>
                                            {/* Every category gets a segment so the bar spans the full width. */}
                                            <MeterStrip
                                                className="mt-2"
                                                segments={categoryBreakdown.map((c, index) => ({
                                                    label: c.name,
                                                    value: totalSpent > 0 ? (c.value / totalSpent) * 100 : 0,
                                                    className: seriesClass(index),
                                                }))}
                                            />
                                        </div>

                                        <ul role="list" className="mt-5 space-y-2">
                                            {categoryBreakdown.slice(0, 6).map((c, index) => {
                                                const pct = totalSpent > 0 ? (c.value / totalSpent) * 100 : 0;
                                                return (
                                                    <li key={c.name} className="flex items-center gap-2 text-xs">
                                                        <span
                                                            className={`${seriesClass(index)} size-2.5 rounded-xs`}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="text-foreground flex-1">{c.name}</span>
                                                        <span className="text-muted-foreground">
                                                            {formatMoney(c.value, currency)} / {pct.toFixed(1)}%
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                )}
                            </div>

                            <p className="mt-5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                {categoryBreakdown.length > 6
                                    ? `View all ${categoryBreakdown.length} categories`
                                    : "View analytics"}
                                <ArrowRight className="h-3 w-3" />
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Boxes summary */}
            {boxes.length > 0 && (
                <BoxesSummaryCard boxes={boxes} currency={currency} />
            )}
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
