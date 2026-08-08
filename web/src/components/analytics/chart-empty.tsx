// Shown in place of a chart with no data, at the chart's own aspect ratio so
// the card doesn't collapse and then jump once data arrives.

import { cn } from "@/lib/utils";

export function ChartEmpty({
  children,
  aspect = "2 / 1",
  className,
}: {
  children: React.ReactNode;
  aspect?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-lg border border-dashed",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      <p className="max-w-[32ch] text-center text-sm text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
