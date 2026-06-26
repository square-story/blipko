// Synthesized "Crisp" interaction-sound engine — no audio assets.
// Inspired by velvet-ui (24h.studio): sounds are synthesized live (slightly
// different every time), quiet by design, warm-but-crisp (a shared lowpass
// keeps them from being harsh), and always mutable. Each sound is a short blip
// (or small layered set) built from oscillator + gain envelopes.

import { useSoundStore } from "@/hooks/use-sound-store";

export type SoundName =
  | "tick" // a button / nav press
  | "toggleOn" // switch/checkbox → on
  | "toggleOff" // switch/checkbox → off
  | "select" // a select/dropdown/menu item chosen
  | "open" // a trigger opens a menu/dialog/popover
  | "confirm" // destructive confirm
  | "success" // positive result
  | "error" // failure
  | "arrival" // a toast/notification appears
  | "celebrate" // onboarding finished
  | "nav"; // route / page navigation

let ctx: AudioContext | null = null;
let entry: AudioNode | null = null; // shared lowpass; all blips connect here

function audio(): { c: AudioContext; out: AudioNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    // Shared warmth + headroom: gentle lowpass → quiet master gain → out.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3600;
    lp.Q.value = 0.4;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5; // quiet by design
    lp.connect(masterGain);
    masterGain.connect(ctx.destination);
    entry = lp;
  }
  return entry ? { c: ctx, out: entry } : null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

// One short note. `type` waveform, `from`→`to` Hz glide over `dur`s, `peak`
// gain, optional `startAt` offset. Tiny detune so no two plays are identical.
function note(
  c: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  from: number,
  to: number,
  dur: number,
  peak: number,
  startAt = 0,
): void {
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  const jitter = 1 + (Math.random() - 0.5) * 0.03;
  osc.type = type;
  osc.frequency.setValueAtTime(from * jitter, t0);
  if (to !== from)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, to * jitter),
      t0 + dur,
    );
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005); // crisp attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function render(c: AudioContext, out: AudioNode, name: SoundName): void {
  switch (name) {
    case "tick":
      // Soft filtered click: body + faint high transient.
      note(c, out, "triangle", 1000, 760, 0.045, 0.05);
      note(c, out, "sine", 2200, 2000, 0.02, 0.025);
      break;
    case "toggleOn":
      note(c, out, "triangle", 660, 990, 0.09, 0.06); // rising ~fifth
      break;
    case "toggleOff":
      note(c, out, "triangle", 880, 560, 0.09, 0.06); // falling
      break;
    case "select":
      note(c, out, "triangle", 880, 920, 0.05, 0.05);
      break;
    case "open":
      note(c, out, "sine", 520, 760, 0.08, 0.05);
      break;
    case "confirm":
      note(c, out, "triangle", 700, 1000, 0.08, 0.07);
      break;
    case "success":
      // Major arpeggio C6–E6–G6.
      [1047, 1319, 1568].forEach((f, i) =>
        note(c, out, "triangle", f, f * 1.01, 0.12, 0.06, i * 0.06),
      );
      break;
    case "error":
      // Soft minor-second fall.
      note(c, out, "sawtooth", 360, 300, 0.14, 0.05);
      note(c, out, "sine", 340, 280, 0.16, 0.04, 0.04);
      break;
    case "arrival":
      note(c, out, "sine", 1320, 1500, 0.07, 0.045);
      break;
    case "nav":
      note(c, out, "sine", 600, 820, 0.06, 0.04);
      break;
    case "celebrate":
      // G5–B5–D6–G6.
      [784, 988, 1175, 1568].forEach((f, i) =>
        note(c, out, "triangle", f, f * 1.01, 0.16, 0.06, i * 0.07),
      );
      break;
  }
}

// Resume a suspended context (call from a user gesture for autoplay policy).
export function resumeAudio(): void {
  const a = audio();
  if (a && a.c.state === "suspended") void a.c.resume();
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
    const a = audio();
    if (!a) return;
    if (a.c.state === "suspended") void a.c.resume();
    render(a.c, a.out, name);
  } catch {
    /* audio is a bonus layer — failures are silent */
  }
}
