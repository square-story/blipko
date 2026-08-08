import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardLoading } from "@/components/analytics/chart-skeleton";

export default function Loading() {
  return (
    <ContentLayout title="Category">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        {/* Matches the CategorySpendChart card this stands in for. */}
        <ChartCardLoading
          title="Spend over time"
          description="This category per budget cycle"
          variant="bars"
          message="Loading this category's history…"
        />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </ContentLayout>
  );
}
