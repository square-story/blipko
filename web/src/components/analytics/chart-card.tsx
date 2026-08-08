// The shell every analytics chart sits in: title, description, an optional
// control in the header, the chart itself, the insight caption, and an optional
// drill-down link.
//
// This exists so the chart components stay pure composition. Each file under
// analytics/charts/ contains only the bklit tree — no Card, no title string, no
// empty-state branch — which keeps them small and keeps all the chrome
// consistent. It also keeps this a server component, so insight captions are
// rendered on the server and never cross into the client bundle.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChartEmpty } from "./chart-empty";
import { ChartInsight } from "./chart-insight";
import type { Insight } from "@/lib/insights";

export interface ChartCardProps {
  title: string;
  description?: string;
  /** Built server-side by lib/insights.ts. null renders nothing. */
  insight?: Insight | null;
  /** Rendered in the header — a range selector, a toggle. */
  action?: React.ReactNode;
  /** When true, `children` is replaced by the empty state. */
  isEmpty?: boolean;
  emptyLabel?: React.ReactNode;
  /** Matches the chart's own aspectRatio so empty and loaded states agree. */
  aspect?: string;
  drill?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  insight,
  action,
  isEmpty = false,
  emptyLabel = "Nothing to show for this period yet.",
  aspect = "2 / 1",
  drill,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {isEmpty ? (
          <ChartEmpty aspect={aspect}>{emptyLabel}</ChartEmpty>
        ) : (
          children
        )}

        <ChartInsight insight={isEmpty ? null : insight} />

        {drill && !isEmpty ? (
          <Link
            href={drill.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {drill.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
