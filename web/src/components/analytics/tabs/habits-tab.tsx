// When spending happens, rather than what it was on.

import { getHabitAnalytics } from "@/lib/actions/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { CycleClampNote } from "@/components/analytics/cycle-clamp-note";
import { WeekdaySpendChart } from "@/components/analytics/charts/weekday-spend-chart";

function hourLabel(hour: number): string {
  if (hour === 0) return "midnight";
  if (hour === 12) return "midday";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

export async function HabitsTab({ range }: { range: number }) {
  const { meta, byWeekday, busiestHour, insights } =
    await getHabitAnalytics(range);

  const total = byWeekday.reduce((s, d) => s + d.total, 0);

  return (
    <>
      <ChartCard
        title="Spending by day of the week"
        description={`Across ${meta.cyclesAvailable} ${meta.cyclesAvailable === 1 ? "cycle" : "cycles"}, in your local time`}
        insight={insights.weekday}
        isEmpty={total === 0}
        emptyLabel="Not enough transactions yet to see a pattern."
      >
        <WeekdaySpendChart
          data={byWeekday}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      {busiestHour !== null && total > 0 && (
        <p className="text-sm text-muted-foreground">
          Most of your spending is logged around {hourLabel(busiestHour)}. Worth
          a pinch of salt: recurring charges post automatically at a fixed hour
          and can&apos;t be told apart from things you actually did.
        </p>
      )}

      <CycleClampNote meta={meta} />
    </>
  );
}
