"use client";

// Spend against a limit, as a notched arc.
//
// Replaces a flat Meter bar on the Buckets card and the hand-rolled 64px rings
// on the two detail headers, which between them handled overspend three
// different ways: Meter clamped to 100 and reported the clamped value to screen
// readers, while CircularProgress clamped the arc but printed the raw number,
// so an overspent category showed a full ring reading "143%".
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
  tone: Tone;
  /** Where you should be by now, 0-100. Omit to hide the mark. */
  pacePct?: number;
  /** Centre statistic. Omit and the centre block does not render at all. */
  centerValue?: number;
  /** Caption under the centre value. */
  label?: string;
  /** ISO code, so the centre reads ₹3,900 like every other money figure. */
  currency?: string;
  /** Outer size in px. Drives width, height and minWidth together. */
  size?: number;
  /** Accessible description, e.g. "Needs budget used". */
  ariaLabel?: string;
  className?: string;
}

// 40 notches only reads above roughly 200px; below that they merge into a ring.
function notchesFor(size: number): number {
  if (size >= 220) return 40;
  if (size >= 160) return 32;
  return 24;
}

export function BudgetGauge({
  pct,
  tone,
  pacePct,
  centerValue,
  label,
  currency,
  size = 120,
  ariaLabel,
  className,
}: BudgetGaugeProps) {
  const safePct = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  // The gauge does not clamp: at 143 every notch simply activates. That is the
  // wanted behaviour — the arc reads full and the tone carries the overspend,
  // rather than a clamped 100 that hides it.
  const over = safePct > 100;

  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
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
        totalNotches={notchesFor(size)}
        activeFill={TONE_FILL[tone]}
        // Past 100 every notch is active anyway, so the only way to show the
        // overflow is to tint the track behind it. It echoes the tone rather
        // than always going red: exceeding a SAVINGS target is a win, and the
        // caller's tone already says which way it reads.
        inactiveFill={over ? TONE_FILL[tone] : "var(--border)"}
        inactiveFillOpacity={over ? 0.35 : 0.8}
        markerValue={pacePct}
        // --foreground, not --chart-foreground: the latter is a mid grey in
        // dark mode and the mark all but vanishes against the track. This one
        // inverts to near-white, so the mark reads in both themes.
        markerFill="var(--foreground)"
        width={size}
        height={size}
        minWidth={size}
      />
    </div>
  );
}
