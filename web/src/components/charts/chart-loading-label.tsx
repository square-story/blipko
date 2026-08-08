"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
// Registry ships this as "../components/shimmering-text" — a monorepo-relative
// path that resolves to components/components/ once vendored. Use the alias.
import { ShimmeringText } from "@/components/shimmering-text";
import {
  LINE_LOADING_PULSE_EASE,
  LOADING_LABEL_EXIT_S,
  LOADING_LABEL_EXIT_Y_PX,
} from "./line-loading-timing";

export interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading → ready handoff. */
  exiting?: boolean;
}

export function ChartLoadingLabel({
  text = "Loading",
  className,
  exiting = false,
}: ChartLoadingLabelProps) {
  // Local addition: the registry animates this drop-fade-blur exit regardless
  // of prefers-reduced-motion. The text shimmer inside already respects it, so
  // only the movement needs suppressing — the label still disappears, it just
  // does not travel. Matches the patches in bar.tsx and pie-slice.tsx.
  // Re-apply after a `shadcn add @bklit/line-chart` or `@bklit/area-chart`.
  const prefersReducedMotion = useReducedMotion();

  if (!text.trim()) {
    return null;
  }

  return (
    <motion.div
      animate={{
        y: exiting && !prefersReducedMotion ? LOADING_LABEL_EXIT_Y_PX : 0,
        opacity: exiting ? 0 : 1,
        filter: exiting && !prefersReducedMotion ? "blur(2px)" : "blur(0px)",
      }}
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      )}
      initial={false}
      role="status"
      transition={{
        duration: LOADING_LABEL_EXIT_S,
        ease: [...LINE_LOADING_PULSE_EASE],
      }}
    >
      <ShimmeringText
        className="font-medium text-sm tracking-wide [--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]"
        text={text}
      />
    </motion.div>
  );
}

export default ChartLoadingLabel;
