"use client";

// Spend against a limit, as a notched arc.
//
// Replaces the flat Meter bars and the hand-rolled rings this app used to show
// budget progress with. Between them they handled overspend three different
// ways: Meter clamped to 100 and reported the clamped value to screen readers,
// while the ring clamped the arc but printed the raw number, so an overspent
// category showed a full ring reading "143%" — and had no aria at all.
//
// The pace mark is the point of it. "68% spent" says little; "68% spent, and
// you should be at 39%" is the whole story, and day/daysInPeriod is already on
// every payload that reaches these surfaces.
//
// Takes a Tone rather than deriving one. The Buckets card thresholds on
// percentage (toneForSpend, 80/100) while the category header thresholds on
// pacing (overSpent / overPace && reliable); both are right for their own
// question, and folding them together here would silently change what one of
// them shows.

import { Gauge } from "@/components/charts/gauge";
import { TONE_FILL, type Tone } from "@/lib/chart-palette";
import { cn } from "@/lib/utils";

export interface BudgetGaugeProps {
  /** spent / budget * 100. Passed through unclamped — see below. */
  pct: number;
  /**
   * "primary" is the app's neutral-but-healthy state, which several callers
   * already use and which is not one of the status tones. Accepted here so no
   * caller has to downgrade it to "neutral" and render a healthy budget grey.
   */
  tone: Tone | "primary";
  /**
   * "arc" (default) is a fixed square; "linear" is a notched bar that fills its
   * container, for the places that were a full-width Meter.
   */
  orientation?: "arc" | "linear";
  /** Where you should be by now, 0-100. Omit to hide the mark. */
  pacePct?: number;
  /** Centre statistic. Omit and the centre block does not render at all. */
  centerValue?: number;
  /** Caption under the centre value. */
  label?: string;
  /** ISO code, so the centre reads ₹3,900 like every other money figure. */
  currency?: string;
  /** Arc only: outer size in px. Drives width, height and minWidth together. */
  size?: number;
  /** Linear only: bar thickness in px. */
  thickness?: number;
  /** Accessible description, e.g. "Needs budget used". */
  ariaLabel?: string;
  className?: string;
}

// Notch count has to fall with the arc's circumference or the notches merge
// into a solid ring. A linear bar spans its whole container, so it affords far
// more of them than any arc.
function notchesFor(size: number, orientation: "arc" | "linear"): number {
  if (orientation === "linear") return 56;
  if (size >= 220) return 40;
  if (size >= 160) return 32;
  if (size >= 90) return 24;
  return 16;
}

export function BudgetGauge({
  pct,
  tone,
  orientation = "arc",
  pacePct,
  centerValue,
  label,
  currency,
  size = 120,
  thickness = 14,
  ariaLabel,
  className,
}: BudgetGaugeProps) {
  const isLinear = orientation === "linear";
  const fill = tone === "primary" ? "var(--primary)" : TONE_FILL[tone];
  const safePct = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  // The gauge does not clamp: at 143 every notch simply activates. That is the
  // wanted behaviour — the arc reads full and the tone carries the overspend,
  // rather than a clamped 100 that hides it.
  const over = safePct > 100;

  return (
    <div
      className={cn(isLinear ? "w-full" : "shrink-0", className)}
      // Linear fills its container; ParentSize measures it, so no fixed width.
      style={isLinear ? undefined : { width: size, height: size }}
      // The SVG inside is aria-hidden, so the number has to be exposed here or
      // the gauge is invisible to a screen reader — which is what the rings it
      // replaces actually were.
      role="progressbar"
      aria-valuenow={Math.round(safePct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <Gauge
        value={safePct}
        centerValue={centerValue}
        defaultLabel={label}
        // The centre sits inside a shell with a 52px minimum radius, so a long
        // figure runs into the notches — ₹24,200 overlaps at this size where
        // ₹3,900 fits. Compact above 10k keeps it inside the ring.
        formatOptions={{
          ...(currency ? { style: "currency" as const, currency } : {}),
          ...((centerValue ?? 0) >= 10_000
            ? { notation: "compact" as const, maximumFractionDigits: 1 }
            : { notation: "standard" as const, maximumFractionDigits: 0 }),
        }}
        orientation={orientation}
        totalNotches={notchesFor(size, orientation)}
        activeFill={fill}
        // Past 100 every notch is active anyway, so the only way to show the
        // overflow is to tint the track behind it. It echoes the tone rather
        // than always going red: exceeding a SAVINGS target is a win, and the
        // caller's tone already says which way it reads.
        inactiveFill={over ? fill : "var(--border)"}
        inactiveFillOpacity={over ? 0.35 : 0.8}
        markerValue={pacePct}
        // The mark has to contrast with whatever it lands on, and that differs:
        // behind the fill it sits on a saturated (or near-black) notch, ahead of
        // it on the pale track. Punch it out in --background when it is inside
        // the fill, draw it in --foreground when it is on the track. Both
        // tokens invert, so this holds in dark mode too.
        markerFill={
          pacePct !== undefined && pacePct <= safePct
            ? "var(--background)"
            : "var(--foreground)"
        }
        {...(isLinear
          ? { linearHeight: thickness, minWidth: 120 }
          : { width: size, height: size, minWidth: size })}
      />
    </div>
  );
}
