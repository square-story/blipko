import { Suspense } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { CycleRangeControl } from "@/components/analytics/cycle-range-control";
import { ChartCardSkeleton } from "@/components/analytics/chart-skeleton";
import { OverviewTab } from "@/components/analytics/tabs/overview-tab";
import { CashflowTab } from "@/components/analytics/tabs/cashflow-tab";
import { CategoriesTab } from "@/components/analytics/tabs/categories-tab";
import { CommitmentsTab } from "@/components/analytics/tabs/commitments-tab";
import { HabitsTab } from "@/components/analytics/tabs/habits-tab";
import {
  loadAnalyticsParams,
  normalizeRange,
} from "@/lib/analytics/search-params";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function TabFallback({ charts = 2 }: { charts?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: charts }, (_, i) => (
        <ChartCardSkeleton key={i} variant={i === 0 ? "line" : "bars"} />
      ))}
    </div>
  );
}

export default async function Page({ searchParams }: PageProps) {
  // The page itself awaits nothing but the URL state. Each tab is an async
  // server component that fetches its own data inside its own Suspense
  // boundary, so the shell paints immediately and the slowest query gates only
  // its own panel.
  const { range } = await loadAnalyticsParams(searchParams);
  const cycles = normalizeRange(range);

  return (
    <ContentLayout title="Analytics">
      <div className="flex flex-col gap-6 pb-8">
        {/* nuqs reads useSearchParams, so the client controls need a Suspense
            boundary or Next bails the whole route out to client rendering. */}
        <Suspense fallback={<TabFallback />}>
          <AnalyticsTabs
            action={<CycleRangeControl />}
            panels={{
              overview: (
                <Suspense fallback={<TabFallback charts={3} />}>
                  <OverviewTab range={cycles} />
                </Suspense>
              ),
              cashflow: (
                <Suspense fallback={<TabFallback charts={4} />}>
                  <CashflowTab range={cycles} />
                </Suspense>
              ),
              categories: (
                <Suspense fallback={<TabFallback charts={2} />}>
                  <CategoriesTab range={cycles} />
                </Suspense>
              ),
              commitments: (
                <Suspense fallback={<TabFallback charts={2} />}>
                  <CommitmentsTab />
                </Suspense>
              ),
              habits: (
                <Suspense fallback={<TabFallback charts={1} />}>
                  <HabitsTab range={cycles} />
                </Suspense>
              ),
            }}
          />
        </Suspense>
      </div>
    </ContentLayout>
  );
}
