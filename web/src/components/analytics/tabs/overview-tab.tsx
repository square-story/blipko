// Where the current cycle stands, and whether the pace is sustainable.

import Link from "next/link";
import { getOverviewAnalytics } from "@/lib/actions/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { CycleClampNote } from "@/components/analytics/cycle-clamp-note";
import { BurnDownChart } from "@/components/analytics/charts/burn-down-chart";
import { BucketMixChart } from "@/components/analytics/charts/bucket-mix-chart";
import { Meter } from "@/components/ui/meter";
import { BudgetGauge } from "@/components/analytics/charts/budget-gauge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Stat,
  StatDescription,
  StatLabel,
  StatValue,
} from "@/components/ui/stat";
import { formatMoney } from "@/lib/budget";
import { TONE, seriesClass, toneForBucket } from "@/lib/chart-palette";
import { expensesHref } from "@/lib/analytics/drilldown";
import { cn } from "@/lib/utils";

export async function OverviewTab({ range }: { range: number }) {
  const {
    meta,
    current,
    wholeBudget,
    byBucket,
    burnDown,
    bucketTrend,
    topCategories,
    insights,
  } = await getOverviewAnalytics(range);

  const money = (n: number) => formatMoney(n, meta.currency, meta.locale);
  const cycle = meta.cycles[meta.cycles.length - 1];
  const noSpend = current.spend === 0 && current.income === 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat>
          <StatLabel>Income</StatLabel>
          <StatValue className={cn("font-mono tabular-nums", TONE.positive)}>
            {money(current.income)}
          </StatValue>
          <StatDescription>this cycle</StatDescription>
        </Stat>

        <Stat>
          <StatLabel>Spent</StatLabel>
          <StatValue className="font-mono tabular-nums">
            {money(current.spend)}
          </StatValue>
          <StatDescription>
            day {current.day} of {current.daysInPeriod}
          </StatDescription>
        </Stat>

        <Stat>
          <StatLabel>Net</StatLabel>
          <StatValue
            className={cn(
              "font-mono tabular-nums",
              current.net >= 0 ? TONE.positive : TONE.negative,
            )}
          >
            {money(current.net)}
          </StatValue>
          <StatDescription>
            {current.net >= 0 ? "kept so far" : "over what came in"}
          </StatDescription>
        </Stat>

        <Stat>
          <StatLabel>Safe daily spend</StatLabel>
          <StatValue className="font-mono tabular-nums">
            {wholeBudget.budget === null ? "—" : money(wholeBudget.safeDaily)}
          </StatValue>
          <StatDescription>
            {wholeBudget.budget === null
              ? "set an income to see this"
              : `for ${current.remainingDays} more ${current.remainingDays === 1 ? "day" : "days"}`}
          </StatDescription>
        </Stat>
      </div>

      <ChartCard
        title="This cycle so far"
        description={
          wholeBudget.budget === null
            ? "Spending to date"
            : "Spending to date against the pace that lands exactly on budget"
        }
        insight={insights.pacing}
        isEmpty={noSpend}
        emptyLabel="Nothing logged this cycle yet."
        drill={
          cycle
            ? {
                href: expensesHref({ from: cycle.start, to: cycle.end }),
                label: "See this cycle's transactions",
              }
            : undefined
        }
      >
        <BurnDownChart
          data={burnDown}
          budget={wholeBudget.budget}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buckets</CardTitle>
            <CardDescription>Where this cycle&apos;s budget stands</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {byBucket.map((b) => (
              <Link
                key={b.bucket}
                href={b.href}
                className="flex flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-muted/50"
              >
                <BudgetGauge
                  pct={b.pct}
                  tone={b.budget === null ? "neutral" : toneForBucket(b.bucket, b.pct)}
                  centerValue={b.spent}
                  label={b.label}
                  currency={meta.currency}
                  size={132}
                  ariaLabel={`${b.label} budget used`}
                />
                <span className="text-center font-mono text-xs tabular-nums text-muted-foreground">
                  {b.budget === null ? "no budget" : `of ${money(b.budget)}`}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
            <CardDescription>Biggest spends this cycle</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No spend yet this cycle.
              </p>
            ) : (
              <ul className="space-y-4">
                {topCategories.map((c, i) => (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "size-2.5 shrink-0 rounded-xs",
                            seriesClass(i),
                          )}
                        />
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {money(c.value)}
                      </span>
                    </div>
                    <Meter
                      value={c.pct}
                      size="sm"
                      className="mt-1.5"
                      label={`${c.name} share`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ChartCard
        title="Bucket mix over time"
        description={`Needs, wants and savings across ${meta.cyclesAvailable} ${meta.cyclesAvailable === 1 ? "cycle" : "cycles"}`}
        insight={insights.bucketTrend}
        isEmpty={bucketTrend.every((b) => b.total === 0)}
      >
        <BucketMixChart
          data={bucketTrend}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <CycleClampNote meta={meta} />
    </>
  );
}
