// What is already spoken for before any discretionary spending happens.
//
// Nothing in the app aggregated RecurringRule before — the rules were listed
// but never totalled, so "how much of my month is already committed" had no
// answer anywhere.

import { getCommitmentAnalytics } from "@/lib/actions/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { CommitmentLoadChart } from "@/components/analytics/charts/commitment-load-chart";
import { ObligationCalendarChart } from "@/components/analytics/charts/obligation-calendar-chart";
import { MeterStrip } from "@/components/ui/meter";
import {
  Stat,
  StatDescription,
  StatLabel,
  StatValue,
} from "@/components/ui/stat";
import { formatMoney } from "@/lib/budget";
import { TONE } from "@/lib/chart-palette";
import { cn } from "@/lib/utils";

export async function CommitmentsTab() {
  const { meta, totals, calendar, rules, insights } =
    await getCommitmentAnalytics();

  const money = (n: number) => formatMoney(n, meta.currency, meta.locale);
  const committedPct = totals.committedPct ?? 0;

  if (rules.length === 0) {
    return (
      <ChartCard
        title="Recurring commitments"
        description="Rent, subscriptions, salary and standing transfers"
        isEmpty
        emptyLabel="No recurring rules set up yet. Add them from the Recurring page and they'll show up here."
      >
        <div />
      </ChartCard>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat>
          <StatLabel>Committed each month</StatLabel>
          <StatValue className="font-mono tabular-nums">
            {money(totals.committed)}
          </StatValue>
          <StatDescription>charges plus standing transfers</StatDescription>
        </Stat>

        <Stat>
          <StatLabel>Left to allocate</StatLabel>
          <StatValue
            className={cn(
              "font-mono tabular-nums",
              totals.discretionary > 0 ? TONE.positive : TONE.negative,
            )}
          >
            {totals.incomeBasis > 0 ? money(totals.discretionary) : "—"}
          </StatValue>
          <StatDescription>
            {totals.incomeBasis > 0
              ? "after commitments"
              : "set an income to see this"}
          </StatDescription>
        </Stat>

        <Stat>
          <StatLabel>Recurring income</StatLabel>
          <StatValue className={cn("font-mono tabular-nums", TONE.positive)}>
            {money(totals.recurringIncome)}
          </StatValue>
          <StatDescription>expected each month</StatDescription>
        </Stat>
      </div>

      {totals.incomeBasis > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium">
            {Math.round(committedPct)}% of your income is committed before you
            spend anything
          </p>
          <MeterStrip
            className="mt-3"
            size="md"
            segments={[
              {
                label: "Committed",
                value: Math.min(100, committedPct),
                className: "bg-chart-flow-out",
              },
              {
                label: "Discretionary",
                value: Math.max(0, 100 - committedPct),
                className: "bg-muted-foreground/30",
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {money(totals.committed)} committed · {money(totals.discretionary)}{" "}
            free
          </p>
        </div>
      )}

      <ChartCard
        title="What's committed"
        description="Every active recurring rule, largest first"
        insight={insights.load}
        aspect="3 / 2"
      >
        <CommitmentLoadChart
          data={rules}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <ChartCard
        title="When it lands"
        description="Recurring charges by day of the budget cycle, not day of the month — a rule dated the 5th lands mid-cycle if you're paid on the 25th"
        aspect="3 / 1"
        isEmpty={calendar.every(
          (d) => d.expense === 0 && d.income === 0 && d.box === 0,
        )}
      >
        <ObligationCalendarChart
          data={calendar}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>
    </>
  );
}
