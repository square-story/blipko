import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/budget";
import type { CategoryDetail } from "@/lib/actions/categories";

export function CategoryTopNotes({ detail }: { detail: CategoryDetail }) {
  // Nothing repeated this cycle — the table below already says everything.
  if (detail.topNotes.length === 0) return null;

  const money = (n: number) => formatMoney(n, detail.currency, detail.locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most frequent</CardTitle>
        <CardDescription>
          Notes you logged more than once this cycle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {detail.topNotes.map((n) => (
          <div
            key={n.note}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate">{n.note}</span>
            <span className="shrink-0 text-muted-foreground">
              <span className="text-xs">{n.count}×</span>{" "}
              <span className="font-mono tabular-nums text-foreground">
                {money(n.total)}
              </span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
