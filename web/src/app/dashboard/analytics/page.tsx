import { Suspense } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { CycleRangeControl } from "@/components/analytics/cycle-range-control";
import { OverviewTab } from "@/components/analytics/tabs/overview-tab";
import { CashflowTab } from "@/components/analytics/tabs/cashflow-tab";
import { CategoriesTab } from "@/components/analytics/tabs/categories-tab";
import { CommitmentsTab } from "@/components/analytics/tabs/commitments-tab";
import { HabitsTab } from "@/components/analytics/tabs/habits-tab";
import {
  CashflowFallback,
  CategoriesFallback,
  CommitmentsFallback,
  HabitsFallback,
  OverviewFallback,
} from "@/components/analytics/tabs/fallbacks";
import {
  loadAnalyticsParams,
  normalizeRange,
} from "@/lib/analytics/search-params";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
        <Suspense fallback={<OverviewFallback />}>
          <AnalyticsTabs
            action={<CycleRangeControl />}
            panels={{
              overview: (
                <Suspense fallback={<OverviewFallback />}>
                  <OverviewTab range={cycles} />
                </Suspense>
              ),
              cashflow: (
                <Suspense fallback={<CashflowFallback />}>
                  <CashflowTab range={cycles} />
                </Suspense>
              ),
              categories: (
                <Suspense fallback={<CategoriesFallback />}>
                  <CategoriesTab />
                </Suspense>
              ),
              commitments: (
                <Suspense fallback={<CommitmentsFallback />}>
                  <CommitmentsTab />
                </Suspense>
              ),
              habits: (
                <Suspense fallback={<HabitsFallback />}>
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
