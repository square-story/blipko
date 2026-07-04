"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { playSound, resumeAudio, type SoundName } from "@/lib/sound";
import { useSoundStore } from "@/hooks/use-sound-store";

// Ordered selector → sound map. The first match (nearest ancestor) wins, so put
// the more specific controls first. Because every shadcn ui/* renders a stable
// `data-slot`, this covers all current and future controls with no per-component
// wiring — instrument the design system once.
const RULES: { selector: string; sound: SoundName | "toggle" }[] = [
  { selector: '[data-slot="switch"],[data-slot="checkbox"]', sound: "toggle" },
  {
    selector:
      '[data-slot="select-item"],[data-slot="dropdown-menu-item"],[data-slot="dropdown-menu-radio-item"],[data-slot="dropdown-menu-checkbox-item"],[data-slot="command-item"],[data-slot="tabs-trigger"],[data-slot="radio-group-item"],[role="option"]',
    sound: "select",
  },
  { selector: '[data-slot="slider"],[data-slot="slider-thumb"]', sound: "slide" },
  { selector: '[data-slot$="-trigger"]', sound: "open" },
  { selector: '[data-slot="button"]', sound: "tick" },
];

const DISABLED = '[disabled],[aria-disabled="true"],[data-disabled]';

export function SoundProvider() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  // Route change → nav. Covers programmatic navigation too, not just link clicks
  // (the old link-pointerdown rule is dropped so this doesn't double-fire).
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    playSound("nav");
  }, [pathname]);

  useEffect(() => {
    // If the user never chose and the OS prefers reduced motion, default off.
    if (
      !useSoundStore.getState().userSet &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      useSoundStore.setState({ enabled: false });
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      resumeAudio(); // first gesture also unlocks the AudioContext
      for (const rule of RULES) {
        const el = target.closest(rule.selector);
        if (!el) continue;
        if (el.closest(DISABLED)) return;
        if (rule.sound === "toggle") {
          // aria-checked is the state BEFORE this click flips it.
          const on = el.getAttribute("aria-checked") === "true";
          playSound(on ? "toggleOff" : "toggleOn");
        } else {
          playSound(rule.sound);
        }
        return;
      }
    };

    // Opt-in hover: only elements explicitly marked [data-sound-hover] (never all
    // buttons — hover-spam on frequent controls is the anti-pattern). Fires once
    // per entered element, not while moving within it.
    let hovered: Element | null = null;
    const onPointerOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-sound-hover]") ?? null;
      if (el === hovered) return;
      hovered = el;
      if (el && !el.closest(DISABLED)) playSound("hover");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
    };
  }, []);

  return null;
}
