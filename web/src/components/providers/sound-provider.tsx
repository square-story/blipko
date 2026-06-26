"use client";

import { useEffect } from "react";
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
      '[data-slot="select-item"],[data-slot="dropdown-menu-item"],[data-slot="dropdown-menu-radio-item"],[data-slot="dropdown-menu-checkbox-item"],[data-slot="command-item"],[role="option"]',
    sound: "select",
  },
  { selector: '[data-slot$="-trigger"]', sound: "open" },
  { selector: '[data-slot="button"]', sound: "tick" },
  { selector: 'a[href],[role="link"]', sound: "nav" },
];

const DISABLED = '[disabled],[aria-disabled="true"],[data-disabled]';

export function SoundProvider() {
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

    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
