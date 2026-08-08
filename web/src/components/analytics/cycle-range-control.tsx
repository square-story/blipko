"use client";

// How many budget cycles the charts cover. shallow: false because this changes
// what the server actions return — unlike the tab switch, it genuinely needs a
// round trip. Matches the convention in the transaction tables.

import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CYCLE_RANGES, analyticsParams } from "@/lib/analytics/search-params";

export function CycleRangeControl() {
  const [range, setRange] = useQueryState(
    "range",
    analyticsParams.range.withOptions({ shallow: false }),
  );

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border bg-card p-1"
      role="group"
      aria-label="Number of budget cycles to show"
    >
      {CYCLE_RANGES.map((n) => (
        <Button
          key={n}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={range === n}
          onClick={() => setRange(n)}
          className={cn(
            "h-7 px-3 text-xs font-medium",
            range === n && "bg-secondary text-secondary-foreground",
          )}
        >
          {n} cycles
        </Button>
      ))}
    </div>
  );
}
