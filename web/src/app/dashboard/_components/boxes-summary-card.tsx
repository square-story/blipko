import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/budget";
import { BudgetGauge } from "@/components/analytics/charts/budget-gauge";
import type { BoxView } from "@/lib/actions/boxes";

// Read-only dashboard summary of the user's boxes (savings goals & funds).
export function BoxesSummaryCard({
  boxes,
  currency,
}: {
  boxes: BoxView[];
  currency: string;
}) {
  const shown = boxes.slice(0, 5);
  const extra = boxes.length - shown.length;

  return (
    <Card className="reveal-rise">
      <CardHeader>
        <CardTitle>
          <Link href="/dashboard/boxes" className="hover:underline">
            Boxes
          </Link>
        </CardTitle>
        <CardDescription>Savings goals &amp; funds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shown.map((b) => {
            // Progress includes tracked budget spend; the headline stays balance.
            // Not clamped: the gauge shows a beaten target as a full, tinted
            // bar and reports the true figure, where the old Meter capped both
            // the bar and what it announced at 100.
            const pct =
              b.targetAmount && b.targetAmount > 0
                ? ((b.balance + b.tracked) / b.targetAmount) * 100
                : null;
            return (
              <Link
                key={b.id}
                href={`/dashboard/boxes/${b.id}`}
                className="-mx-2 block space-y-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {b.icon && <span className="shrink-0">{b.icon}</span>}
                    <span className="truncate text-sm font-medium">{b.name}</span>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium">
                    {formatMoney(b.balance, currency)}
                    {b.targetAmount != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        / {formatMoney(b.targetAmount, currency)}
                      </span>
                    )}
                  </div>
                </div>
                {pct != null && (
                  // No pace mark: a savings target has no cycle to be on track
                  // within, matching every other box surface.
                  <BudgetGauge
                    pct={pct}
                    tone={pct >= 100 ? "positive" : "primary"}
                    orientation="linear"
                    thickness={8}
                    ariaLabel={`${b.name} progress`}
                  />
                )}
              </Link>
            );
          })}
          {extra > 0 && (
            <Link
              href="/dashboard/boxes"
              className="block text-xs text-muted-foreground hover:underline"
            >
              + {extra} more
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
