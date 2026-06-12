"use client";

import "slot-text/style.css";
import { useEffect, useState } from "react";
import { SlotText } from "slot-text/react";

/**
 * Text-roll (slot-machine) label for short, tactile button text.
 *
 * slot-text is browser-only DOM, so render plain text on the server / before
 * mount to avoid a hydration mismatch + SSR document access, then let SlotText
 * take over once mounted. `skipUnchanged: false` makes equal-length word swaps
 * (e.g. "Save changes" → "Saved") still roll.
 */
export function SlotLabel({ text }: { text: string }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return <span>{text}</span>;

  return (
    <SlotText text={text} options={{ skipUnchanged: false, direction: "down" }} />
  );
}
