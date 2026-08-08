// What the money went on, and what changed since last cycle.

import { getCategoryAnalytics } from "@/lib/actions/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { CategoryDonutChart } from "@/components/analytics/charts/category-donut-chart";
import { CategoryMoversChart } from "@/components/analytics/charts/category-movers-chart";
import { expensesHref } from "@/lib/analytics/drilldown";

export async function CategoriesTab() {
  const { meta, breakdown, movers, hasPreviousCycle, insights } =
    await getCategoryAnalytics();

  const cycle = meta.cycles[meta.cycles.length - 1];
  const hasUncategorized = breakdown.some((b) => b.href === null);

  return (
    <>
      <ChartCard
        title="Where the money went"
        description="This cycle, by category"
        insight={insights.breakdown}
        isEmpty={breakdown.length === 0}
        emptyLabel="No spend recorded this cycle yet."
        aspect="1 / 1"
        drill={
          cycle
            ? {
                href: expensesHref({ from: cycle.start, to: cycle.end }),
                label: "See this cycle's transactions",
              }
            : undefined
        }
      >
        <CategoryDonutChart
          data={breakdown}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <ChartCard
        title="Biggest changes"
        description="How each category compares with the cycle before"
        insight={insights.movers}
        isEmpty={movers.length === 0}
        aspect="3 / 2"
        emptyLabel={
          hasPreviousCycle
            ? "Nothing moved much between the last two cycles."
            : "Needs a full previous cycle to compare against — check back next cycle."
        }
      >
        <CategoryMoversChart
          data={movers}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      {hasUncategorized && (
        <p className="text-sm text-muted-foreground">
          Uncategorised spending has no category to filter by, so it is shown but
          not clickable. It appears when a category is deleted — its past
          expenses stay, but lose their label.
        </p>
      )}
    </>
  );
}
