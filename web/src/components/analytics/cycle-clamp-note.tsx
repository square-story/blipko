// Says so when the cycle range control could not be honoured.
//
// windowsFor() clamps the requested windows to the life of the account, so an
// account younger than three cycles gets the same charts at 3, 6 and 12. Without
// this the control looks broken: you click, the page round-trips, nothing moves.
//
// Lives on every tab that offers the control (see RANGE_AWARE_TABS). It started
// as inline copy on Overview only, which is exactly where it was least needed —
// Overview is mostly current-cycle anyway.

import { ChartInsight } from "@/components/analytics/chart-insight";
import type { AnalyticsMeta } from "@/lib/actions/analytics";

export function CycleClampNote({ meta }: { meta: AnalyticsMeta }) {
  if (meta.cyclesAvailable >= meta.cyclesRequested) return null;

  return (
    <ChartInsight
      insight={{
        text: `Only ${meta.cyclesAvailable} ${meta.cyclesAvailable === 1 ? "cycle" : "cycles"} of history so far — showing everything since you started.`,
        tone: "neutral",
      }}
    />
  );
}
