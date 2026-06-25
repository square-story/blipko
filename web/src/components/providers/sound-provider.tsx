"use client";

import { useEffect } from "react";
import { resumeAudio } from "@/lib/sound";
import { useSoundStore } from "@/hooks/use-sound-store";

// Unlocks the AudioContext on the first user gesture (autoplay policy) and, if
// the user has never chosen and the OS prefers reduced motion, defaults sounds
// off. Renders nothing.
export function SoundProvider() {
  useEffect(() => {
    // If the user never chose and the OS prefers reduced motion, default off
    // (without marking it as a user choice, so the toggle still reflects intent).
    if (
      !useSoundStore.getState().userSet &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      useSoundStore.setState({ enabled: false });
    }

    const unlock = () => resumeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return null;
}
