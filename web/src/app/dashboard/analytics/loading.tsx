import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardSkeleton } from "@/components/analytics/chart-skeleton";

// Shaped like the page it stands in for. The previous version was eight
// identical h-12 bars, which resembled nothing on screen and made the swap to
// real content a jump.
export default function Loading() {
  return (
    <div className="container px-4 pt-8 pb-8 sm:px-8">
      <Skeleton className="mb-4 h-4 w-48" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>

        <ChartCardSkeleton variant="line" />
        <ChartCardSkeleton variant="bars" />
      </div>
    </div>
  );
}
