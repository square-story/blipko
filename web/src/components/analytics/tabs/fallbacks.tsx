// Loading state for each tab, mirroring that tab's real cards.
//
// One fallback per tab rather than a generic "render N identical skeletons",
// so the placeholder carries the same titles, the same aspect ratios and a
// message naming what is actually being fetched. Kept next to the tabs they
// mirror — that is what stops them drifting when a chart is added or resized.
//
// Descriptions that depend on fetched data (the real cards interpolate
// meta.cyclesAvailable) are phrased statically here. The wording shifts
// slightly on swap, which is better than the card growing a line.

import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardLoading } from "@/components/analytics/chart-skeleton";

// KPI tiles are text, not charts — a plain skeleton is the honest placeholder.
function StatRow({ count }: { count: number }) {
  return (
    <div
      className={
        count === 3
          ? "grid gap-4 sm:grid-cols-3"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

export function OverviewFallback() {
  return (
    <div className="flex flex-col gap-6">
      <StatRow count={4} />
      <ChartCardLoading
        title="This cycle so far"
        description="Spending to date against the pace that lands exactly on budget"
        variant="line"
        message="Working out your pace…"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <ChartCardLoading
        title="Bucket mix over time"
        description="Needs, wants and savings across your recent cycles"
        variant="bars"
        message="Splitting up your buckets…"
      />
    </div>
  );
}

export function CashflowFallback() {
  return (
    <div className="flex flex-col gap-6">
      {/* The real chart is a ComposedChart, which has no loading state of its
          own — bars are the closest stand-in, and it is mostly bars anyway. */}
      <ChartCardLoading
        title="Income vs spending"
        description="Money in and money out per budget cycle, with net over the top"
        variant="bars"
        message="Adding up money in and out…"
      />
      <ChartCardLoading
        title="Running balance"
        description="Everything logged in, minus everything out, across your recent cycles"
        variant="area"
        message="Tallying your running balance…"
      />
      <ChartCardLoading
        title="Savings rate"
        description="Share of income kept each cycle, against your target"
        variant="line"
        message="Working out your savings rate…"
      />
      <ChartCardLoading
        title="Savings boxes"
        description="Money added to and taken out of your boxes"
        variant="bars"
        message="Checking your savings boxes…"
      />
    </div>
  );
}

export function CategoriesFallback() {
  return (
    <div className="flex flex-col gap-6">
      <ChartCardLoading
        title="Where the money went"
        description="This cycle, by category"
        variant="donut"
        aspect="1 / 1"
        message="Sorting your categories…"
      />
      <ChartCardLoading
        title="Biggest changes"
        description="How each category compares with the cycle before"
        variant="bars"
        aspect="3 / 2"
        message="Comparing with last cycle…"
      />
    </div>
  );
}

export function CommitmentsFallback() {
  return (
    <div className="flex flex-col gap-6">
      <StatRow count={3} />
      <ChartCardLoading
        title="What's committed"
        description="Every active recurring rule, largest first"
        variant="bars"
        aspect="3 / 2"
        message="Gathering your recurring rules…"
      />
      <ChartCardLoading
        title="When it lands"
        description="Recurring charges by day of the budget cycle, not day of the month — a rule dated the 5th lands mid-cycle if you're paid on the 25th"
        variant="bars"
        aspect="3 / 1"
        message="Mapping them to your cycle…"
      />
    </div>
  );
}

export function HabitsFallback() {
  return (
    <div className="flex flex-col gap-6">
      <ChartCardLoading
        title="Spending by day of the week"
        description="Across your recent cycles, in your local time"
        variant="bars"
        message="Looking at your week…"
      />
    </div>
  );
}
