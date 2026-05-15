"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Something went wrong. Please try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="text-sm underline text-primary hover:opacity-80"
      >
        Try again
      </button>
    </div>
  );
}
