"use client";

// Loading states for charts, using the chart library's own.
//
// These were grey <Skeleton> divs — eight fixed-height bars, or one big rounded
// rectangle. They approximated a silhouette but were not charts and said
// nothing about what was being fetched. bklit ships shimmer-swept placeholder
// bars, a travelling pulse along a skeleton line, a shimmer band across the
// grid, and a centred label that announces itself to screen readers; none of it
// was wired up.
//
// Support is uneven, which is why this file exists rather than each caller
// reaching for a library component directly:
//
//   BarChart    status + turnkey wrapper, but NO label prop
//   Line/Area   status + label
//   Composed    no status at all      -> stands in with the bar loading
//   Pie         no loading vocabulary -> hand-rolled ring, library label
//
// Every loading animation here loops indefinitely and cleans up on unmount, so
// they are safe as open-ended Suspense fallbacks.

import { BarChartLoading } from "@/components/charts/bar-chart-loading";
import { LineChartLoading } from "@/components/charts/line-chart-loading";
import { AreaChartLoading } from "@/components/charts/area-chart-loading";
import { ChartLoadingLabel } from "@/components/charts/chart-loading-label";
import { ChartCard } from "./chart-card";
import { cn } from "@/lib/utils";

export type ChartLoadingVariant = "bars" | "line" | "area" | "donut";

export interface ChartLoadingProps {
  variant?: ChartLoadingVariant;
  /** Must match the real chart's aspectRatio, or the card resizes on swap. */
  aspect?: string;
  /** What is being fetched, e.g. "Working out your pace…". */
  message?: string;
  className?: string;
}

export function ChartLoading({
  variant = "bars",
  aspect = "2 / 1",
  message = "Loading",
  className,
}: ChartLoadingProps) {
  if (variant === "line") {
    return (
      <LineChartLoading
        aspectRatio={aspect}
        className={className}
        label={message}
      />
    );
  }

  if (variant === "area") {
    return (
      <AreaChartLoading
        aspectRatio={aspect}
        className={className}
        label={message}
      />
    );
  }

  if (variant === "donut") {
    // The library has no pie loading state — PieChart never mounts a provider
    // carrying chartPhase, so no child could opt in. Hand-rolled ring, but the
    // caption goes through the library's label so copy, styling and the
    // role="status" announcement match every other chart.
    return (
      <div
        className={cn("relative w-full", className)}
        style={{ aspectRatio: aspect }}
      >
        <div className="flex h-full items-center justify-center">
          <div className="aspect-square h-4/5 animate-pulse rounded-full border-[16px] border-muted" />
        </div>
        <ChartLoadingLabel text={message} />
      </div>
    );
  }

  // BarChart drives its own skeleton — with data={[]} it falls back to 12 bars
  // and fabricates heights from a deterministic hash, so no data or children
  // are needed and there is no hydration mismatch. It has no label prop, hence
  // the overlay; its root is already `relative`, but the wrapper keeps the
  // label anchored to the chart rather than to whatever contains it.
  return (
    <div className={cn("relative w-full", className)}>
      <BarChartLoading aspectRatio={aspect} />
      <ChartLoadingLabel text={message} />
    </div>
  );
}

export interface ChartCardLoadingProps extends ChartLoadingProps {
  title: string;
  description?: string;
}

// A loading chart inside the real card.
//
// Deliberately the actual ChartCard rather than a lookalike: any hand-copied
// chrome drifts from it, and the point of the fallback is that nothing shifts
// when the data lands.
//
// The title and description are known before the data is, so they render as
// themselves rather than as skeleton bars — only the chart body is genuinely
// unresolved.
export function ChartCardLoading({
  title,
  description,
  variant = "bars",
  aspect = "2 / 1",
  message,
}: ChartCardLoadingProps) {
  return (
    <ChartCard title={title} description={description} insight={null}>
      <ChartLoading variant={variant} aspect={aspect} message={message} />
    </ChartCard>
  );
}
