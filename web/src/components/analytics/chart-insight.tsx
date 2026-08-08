// The one-line plain-language caption under each chart.
//
// The text arrives already built and already money-formatted from
// lib/insights.ts, because the wording depends on the user's currency and
// locale. This component only decides how it looks.

import { cn } from "@/lib/utils";
import { TONE_BG, toneForInsight } from "@/lib/chart-palette";
import type { Insight } from "@/lib/insights";

export function ChartInsight({
  insight,
  className,
}: {
  insight: Insight | null | undefined;
  className?: string;
}) {
  // null means "not enough data to say anything honest" — drop the row rather
  // than render an empty one and leave a gap under the chart.
  if (!insight) return null;

  const tone = toneForInsight(insight.tone);

  return (
    <p
      className={cn(
        "flex items-start gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          TONE_BG[tone],
        )}
      />
      <span>{insight.text}</span>
    </p>
  );
}
