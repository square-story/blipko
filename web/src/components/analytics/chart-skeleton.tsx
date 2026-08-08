// Loading fallbacks shaped like the chart they stand in for.
//
// The old analytics/loading.tsx rendered eight identical h-12 bars, which look
// nothing like the page and make the transition to real content a jump. These
// hold the same aspect ratio and rough silhouette, so the swap is quiet.

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ChartSkeletonVariant = "bars" | "line" | "donut";

// Fixed, uneven heights. Randomising them would change on every render and
// defeat the point of a stable placeholder.
const BAR_HEIGHTS = [45, 70, 55, 85, 40, 65, 75, 50];

export function ChartSkeleton({
  variant = "bars",
  aspect = "2 / 1",
  className,
}: {
  variant?: ChartSkeletonVariant;
  aspect?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ aspectRatio: aspect }}
      aria-hidden
    >
      {variant === "donut" ? (
        <div className="flex h-full items-center justify-center">
          <Skeleton className="aspect-square h-4/5 rounded-full" />
        </div>
      ) : variant === "line" ? (
        <div className="flex h-full flex-col justify-end gap-2 p-2">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      ) : (
        <div className="flex h-full items-end gap-2 p-2">
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-md"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Matches a ChartCard: header lines, the chart body, then the caption row.
export function ChartCardSkeleton({
  variant = "bars",
  aspect = "2 / 1",
}: {
  variant?: ChartSkeletonVariant;
  aspect?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <ChartSkeleton variant={variant} aspect={aspect} className="mt-6" />
      <Skeleton className="mt-4 h-4 w-3/5" />
    </div>
  );
}
