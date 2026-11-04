import { flushSync } from "react-dom";

/**
 * Switch theme behind a View Transition: a soft-edged circle grows from `from`'s
 * center (default: top-right corner). Falls back to an instant switch.
 */
export function switchTheme(apply: () => void, from?: Element | null) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return apply();

  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth;
  const y = r ? r.top + r.height / 2 : 0;
  // Distance to the farthest corner; ÷0.7 because the mask's solid core is 70% of its radius.
  const radius =
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    ) / 0.7;

  const s = document.documentElement.style;
  s.setProperty("--vt-x", `${x}px`);
  s.setProperty("--vt-y", `${y}px`);
  s.setProperty("--vt-r", `${radius}px`);
  // next-themes applies the class in a passive effect; flushSync lands it before the "new" snapshot.
  document.startViewTransition(() => flushSync(apply));
}
