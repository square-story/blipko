import { Skeleton } from "@/components/ui/skeleton";
import { OverviewFallback } from "@/components/analytics/tabs/fallbacks";

// Route-level fallback. A loading.tsx cannot read searchParams, so it renders
// the Overview shape — the default tab, and the one most requests land on.
// Once the shell resolves, each tab swaps to its own fallback.
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

        <OverviewFallback />
      </div>
    </div>
  );
}
