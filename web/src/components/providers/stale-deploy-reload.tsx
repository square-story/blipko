"use client";

import { useEffect } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

// A tab opened before a deploy still holds the old build's Server Action IDs.
// Most action callers have no catch, so the miss surfaces as an unhandled
// rejection — reload once to pick up the new bundle instead of failing silently.
export function StaleDeployReload() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (unstable_isUnrecognizedActionError(e.reason)) window.location.reload();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return null;
}
