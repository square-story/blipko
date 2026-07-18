import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/budget";
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
            const pct =
              b.targetAmount && b.targetAmount > 0
                ? Math.min(
                    100,
                    Math.round(((b.balance + b.tracked) / b.targetAmount) * 100),
                  )
                : null;
            return (
              <div key={b.id} className="space-y-1.5">
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
                  <div className="h-1.5 w-full rounded-xs bg-muted">
                    <div
                      className="h-1.5 rounded-xs bg-emerald-500 dark:bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
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
