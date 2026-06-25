// Tiny synthesized "Crisp" interaction-sound engine — no audio assets.
// Inspired by velvet-ui (24h.studio): sounds are synthesized live (slightly
// different every time), quiet by design, and always mutable. Each sound is a
// short bright blip built from oscillator + gain envelopes via the Web Audio API.

import { useSoundStore } from "@/hooks/use-sound-store";

export type SoundName =
  | "tick" // toggles, chips, steps, selects
  | "confirm" // destructive confirm
  | "success" // bright rising — positive result
  | "error" // soft falling — failure
  | "arrival" // a toast / notification appears
  | "celebrate"; // onboarding finished

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

// Resume a suspended context (call from a user gesture to satisfy autoplay rules).
export function resumeAudio(): void {
  const c = audioCtx();
  if (c && c.state === "suspended") void c.resume();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

// A single short blip: type + start/end frequency + duration + peak gain.
function blip(
  c: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  dur: number,
  peak: number,
  startAt = 0,
): void {
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const gain = c.createGain();
  // Tiny jitter so it's never identical twice.
  const jitter = 1 + (Math.random() - 0.5) * 0.04;
  osc.type = type;
  osc.frequency.setValueAtTime(from * jitter, t0);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(1, to * jitter),
    t0 + dur,
  );
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.006); // fast crisp attack
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Quiet by design — keep peaks low.
function render(c: AudioContext, name: SoundName): void {
  switch (name) {
    case "tick":
      blip(c, "triangle", 1100, 850, 0.05, 0.05);
      break;
    case "confirm":
      blip(c, "triangle", 700, 1000, 0.08, 0.07);
      break;
    case "success":
      blip(c, "triangle", 700, 1200, 0.1, 0.07);
      blip(c, "sine", 1000, 1600, 0.12, 0.05, 0.05);
      break;
    case "error":
      blip(c, "sawtooth", 320, 180, 0.16, 0.06);
      break;
    case "arrival":
      blip(c, "sine", 1300, 1500, 0.07, 0.05);
      break;
    case "celebrate": {
      const notes = [784, 988, 1319]; // G5–B5–E6 arpeggio
      notes.forEach((f, i) =>
        blip(c, "triangle", f, f * 1.01, 0.16, 0.06, i * 0.08),
      );
      break;
    }
  }
}

// Play a sound, unless muted or the user prefers reduced motion. Never throws.
export function playSound(name: SoundName): void {
  try {
    if (!useSoundStore.getState().enabled) return;
    if (prefersReducedMotion()) return;
    const c = audioCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    render(c, name);
  } catch {
    /* audio is a bonus layer — failures are silent */
  }
}
