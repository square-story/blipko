import { formatMoney } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { CategoryDetail } from "@/lib/actions/categories";

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl bg-card border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-xl font-bold font-mono tabular-nums mt-1",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

export function CategoryStats({ detail }: { detail: CategoryDetail }) {
  const money = (n: number) => formatMoney(n, detail.currency, detail.locale);
  const up = detail.deltaPct != null && detail.deltaPct > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Tile label="Spent this cycle" value={money(detail.spend)} />
      <Tile label="Transactions" value={String(detail.txnCount)} />
      <Tile
        label="Average"
        value={money(detail.avgTxn)}
        hint={
          detail.largest
            ? `largest ${money(detail.largest.amount)}${detail.largest.note ? ` · ${detail.largest.note}` : ""}`
            : undefined
        }
      />
      {detail.deltaPct == null ? (
        <Tile
          label="vs last cycle"
          value="—"
          hint="nothing spent last cycle"
          tone="text-muted-foreground"
        />
      ) : (
        <div className="rounded-2xl bg-card border p-4">
          <div className="text-xs text-muted-foreground">vs last cycle</div>
          <div
            className={cn(
              "text-xl font-bold font-mono tabular-nums mt-1 flex items-center gap-1",
              // Spending more is bad everywhere except SAVINGS, where the
              // "spend" is money moving toward the goal.
              up === (detail.bucket === "SAVINGS")
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400",
            )}
          >
            {up ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {up ? "+" : ""}
            {Math.round(detail.deltaPct)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            was {money(detail.prevSpend)}
          </div>
        </div>
      )}
    </div>
  );
}
