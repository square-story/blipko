"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that flips true on `trigger()` and auto-resets to false after `ms`.
 * Used for brief "Saved" / "Exported" success labels on action buttons.
 */
export function useTransientFlag(ms = 1500): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [on, trigger];
}
