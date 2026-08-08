// One progress meter, replacing six hand-rolled implementations that had each
// drifted: two in dashboard/page.tsx (one animated via .bar-fill, one a
// segmented strip), one in analytics/page.tsx, one in boxes-summary-card, one
// in bucket-section using scaleX instead of width, and one in account-settings.
// They disagreed on height, radius, colour source and whether they animated.
//
// The .bar-fill technique from dashboard/page.tsx is the one kept: it animates
// a GPU-composited transform rather than width, and globals.css already turns
// it off under prefers-reduced-motion. This is now the only place that knows
// about it.
//
// Server-component safe — no "use client" — so the dashboard tree can keep
// rendering on the server.

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TONE_BG, type Tone } from "@/lib/chart-palette";

const TRACK_SIZE = {
  sm: "h-1.5",
  md: "h-2",
} as const;

export interface MeterProps {
  /** 0-100. Clamped, so an overspent bucket fills rather than overflowing. */
  value: number;
  tone?: Tone | "primary";
  size?: keyof typeof TRACK_SIZE;
  /** Animate the fill on mount. Off for meters inside long lists. */
  animate?: boolean;
  className?: string;
  /** Accessible name, e.g. "Needs budget used". */
  label?: string;
}

function fillClass(tone: Tone | "primary"): string {
  return tone === "primary" ? "bg-primary" : TONE_BG[tone];
}

export function Meter({
  value,
  tone = "primary",
  size = "md",
  animate = false,
  className,
  label,
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const track = TRACK_SIZE[size];

  return (
    <div
      className={cn("w-full rounded-full bg-muted", track, className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "w-full rounded-full",
          track,
          fillClass(tone),
          animate && "bar-fill",
        )}
        // .bar-fill reads --pct as a scaleX factor; without it we fall back to
        // width so a non-animated meter still renders at the right length.
        style={
          animate
            ? ({ "--pct": pct / 100 } as CSSProperties)
            : { width: `${pct}%` }
        }
      />
    </div>
  );
}

export interface MeterSegment {
  /** Share of the whole, 0-100. Segments are rendered in order. */
  value: number;
  /** Tailwind background class, normally from seriesClass(i). */
  className: string;
  label?: string;
}

export interface MeterStripProps {
  segments: MeterSegment[];
  size?: keyof typeof TRACK_SIZE;
  className?: string;
}

// The multi-colour variant: a category breakdown or a needs/wants/savings
// split, where every segment together spans the full width.
export function MeterStrip({
  segments,
  size = "sm",
  className,
}: MeterStripProps) {
  const track = TRACK_SIZE[size];

  return (
    <div className={cn("flex w-full items-center gap-0.5", className)}>
      {segments.map((s, i) => (
        <div
          key={s.label ?? i}
          className={cn("rounded-xs", track, s.className)}
          style={{ width: `${Math.max(0, Math.min(100, s.value))}%` }}
          title={s.label}
        />
      ))}
    </div>
  );
}
