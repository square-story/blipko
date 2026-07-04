// Interaction-sound engine — synthesized (no audio assets), powered by
// @web-kits/audio's declarative `defineSound`. Sounds are quiet by design, warm
// (a baked lowpass keeps them from being harsh), a touch of reverb gives notable
// moments space, and a small random detune per play means no two plays are
// identical. Always mutable via useSoundStore + prefers-reduced-motion.

import {
  defineSound,
  ensureReady,
  setMasterVolume,
  type BiquadFilter,
  type Effect,
  type Layer,
} from "@web-kits/audio";
import { useSoundStore } from "@/hooks/use-sound-store";

export type SoundName =
  | "tick" // a button / nav press
  | "toggleOn" // switch/checkbox → on
  | "toggleOff" // switch/checkbox → off
  | "select" // a select/dropdown/menu/tab/radio item chosen
  | "open" // a trigger opens a menu/dialog/popover/accordion
  | "confirm" // destructive confirm
  | "success" // positive result
  | "error" // failure
  | "arrival" // a toast/notification appears
  | "celebrate" // onboarding finished
  | "nav" // route / page navigation
  | "slide" // slider grabbed
  | "hover"; // opt-in hover on a primary CTA

// Shared warmth (no global filter node in the lib — bake per layer) and a subtle
// room reserved for the "moment" sounds (dry on rapid micro-clicks to stay crisp).
const WARMTH: BiquadFilter = {
  type: "lowpass",
  frequency: 3600,
  resonance: 0.7,
};
const SPACE: Effect = { type: "reverb", decay: 0.35, mix: 0.06 };

// Build an arpeggio as parallel layers with staggered `delay`.
function arp(
  freqs: number[],
  step: number,
  decay: number,
  gain: number,
): Layer[] {
  return freqs.map(
    (f, i): Layer => ({
      source: { type: "triangle", frequency: { start: f, end: f * 1.01 } },
      envelope: { attack: 0, decay, release: 0.03 },
      gain,
      filter: WARMTH,
      delay: i * step,
    }),
  );
}

const PLAYERS: Record<SoundName, (opts?: { detune?: number }) => unknown> = {
  // Soft filtered click: body + faint high transient.
  tick: defineSound({
    layers: [
      {
        source: { type: "triangle", frequency: { start: 920, end: 720 } },
        envelope: { attack: 0, decay: 0.05 },
        gain: 0.5,
        filter: WARMTH,
      },
      {
        source: { type: "sine", frequency: 2200 },
        envelope: { attack: 0, decay: 0.018 },
        gain: 0.18,
        filter: WARMTH,
      },
    ],
  }),
  toggleOn: defineSound({
    source: { type: "triangle", frequency: { start: 660, end: 990 } },
    envelope: { attack: 0, decay: 0.09 },
    gain: 0.5,
    filter: WARMTH,
  }),
  toggleOff: defineSound({
    source: { type: "triangle", frequency: { start: 880, end: 560 } },
    envelope: { attack: 0, decay: 0.09 },
    gain: 0.5,
    filter: WARMTH,
  }),
  select: defineSound({
    source: { type: "triangle", frequency: { start: 880, end: 940 } },
    envelope: { attack: 0, decay: 0.05 },
    gain: 0.45,
    filter: WARMTH,
  }),
  open: defineSound({
    source: { type: "sine", frequency: { start: 520, end: 780 } },
    envelope: { attack: 0, decay: 0.08 },
    gain: 0.45,
    filter: WARMTH,
  }),
  confirm: defineSound({
    layers: [
      {
        source: { type: "triangle", frequency: { start: 700, end: 1020 } },
        envelope: { attack: 0, decay: 0.08 },
        gain: 0.5,
        filter: WARMTH,
      },
    ],
    effects: [SPACE],
  }),
  // Major arpeggio C6–E6–G6.
  success: defineSound({
    layers: arp([1047, 1319, 1568], 0.06, 0.13, 0.5),
    effects: [SPACE],
  }),
  // Soft minor-second fall.
  error: defineSound({
    layers: [
      {
        source: { type: "sawtooth", frequency: { start: 360, end: 300 } },
        envelope: { attack: 0, decay: 0.14 },
        gain: 0.42,
        filter: WARMTH,
      },
      {
        source: { type: "sine", frequency: { start: 340, end: 280 } },
        envelope: { attack: 0, decay: 0.16 },
        gain: 0.32,
        filter: WARMTH,
        delay: 0.04,
      },
    ],
    effects: [SPACE],
  }),
  arrival: defineSound({
    layers: [
      {
        source: { type: "sine", frequency: { start: 1320, end: 1500 } },
        envelope: { attack: 0, decay: 0.07 },
        gain: 0.4,
        filter: WARMTH,
      },
    ],
    effects: [SPACE],
  }),
  nav: defineSound({
    source: { type: "sine", frequency: { start: 600, end: 820 } },
    envelope: { attack: 0, decay: 0.06 },
    gain: 0.4,
    filter: WARMTH,
  }),
  // G5–B5–D6–G6.
  celebrate: defineSound({
    layers: arp([784, 988, 1175, 1568], 0.07, 0.16, 0.5),
    effects: [SPACE],
  }),
  // Tiny, quiet blip — fires once per slider grab.
  slide: defineSound({
    source: { type: "sine", frequency: 1200 },
    envelope: { attack: 0, decay: 0.02 },
    gain: 0.22,
    filter: WARMTH,
  }),
  // Ultra-subtle — opt-in on primary CTAs only.
  hover: defineSound({
    source: { type: "sine", frequency: 2000 },
    envelope: { attack: 0, decay: 0.02 },
    gain: 0.14,
    filter: WARMTH,
  }),
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

let initialized = false;
function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    setMasterVolume(0.4); // quiet by design
  } catch {
    /* no-op */
  }
}

// Resume/unlock the shared AudioContext (call from a user gesture for autoplay policy).
export function resumeAudio(): void {
  if (typeof window === "undefined") return;
  init();
  void ensureReady().catch(() => {});
}

// Collapse duplicate plays of the same sound within this window (ms) — keeps the
// global delegated listener and any explicit calls from double-blipping.
const DEDUPE_MS = 60;
const lastPlayed = new Map<SoundName, number>();

export function playSound(name: SoundName): void {
  try {
    if (!useSoundStore.getState().enabled) return;
    if (prefersReducedMotion()) return;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - (lastPlayed.get(name) ?? -Infinity) < DEDUPE_MS) return;
    lastPlayed.set(name, now);
    init();
    // ±4 cents of drift so no two plays are identical.
    PLAYERS[name]({ detune: (Math.random() - 0.5) * 8 });
  } catch {
    /* audio is a bonus layer — failures are silent */
  }
}
