"use client";

import { useEffect } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stale tab after a deploy: only a full reload fetches the new bundle.
    if (unstable_isUnrecognizedActionError(error)) window.location.reload();
    else console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h2>Something went wrong</h2>
        <button onClick={() => window.location.reload()} style={{ textDecoration: "underline" }}>
          Reload
        </button>
      </body>
    </html>
  );
}
