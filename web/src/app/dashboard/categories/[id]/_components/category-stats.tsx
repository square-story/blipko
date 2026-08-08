import { formatMoney } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Stat,
  StatDescription,
  StatLabel,
  StatValue,
} from "@/components/ui/stat";
import { TONE } from "@/lib/chart-palette";
import type { CategoryDetail } from "@/lib/actions/categories";

// This file used to carry a local `Tile` that re-implemented the Stat
// primitive with raw divs, and a fourth tile that hand-rolled StatTrend's
// icon-plus-colour treatment. Both are now the shared components.
//
// Money keeps `font-mono tabular-nums` so the figures still align in a row.
const MONEY_VALUE = "font-mono tabular-nums";

export function CategoryStats({ detail }: { detail: CategoryDetail }) {
  const money = (n: number) => formatMoney(n, detail.currency, detail.locale);
  const up = detail.deltaPct != null && detail.deltaPct > 0;
  // Spending more is bad everywhere except SAVINGS, where the "spend" is money
  // moving toward the goal.
  const favourable = up === (detail.bucket === "SAVINGS");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat>
        <StatLabel>Spent this cycle</StatLabel>
        <StatValue className={MONEY_VALUE}>{money(detail.spend)}</StatValue>
      </Stat>

      <Stat>
        <StatLabel>Transactions</StatLabel>
        <StatValue className={MONEY_VALUE}>{detail.txnCount}</StatValue>
      </Stat>

      <Stat>
        <StatLabel>Average</StatLabel>
        <StatValue className={MONEY_VALUE}>{money(detail.avgTxn)}</StatValue>
        {detail.largest && (
          <StatDescription className="truncate">
            largest {money(detail.largest.amount)}
            {detail.largest.note ? ` · ${detail.largest.note}` : ""}
          </StatDescription>
        )}
      </Stat>

      <Stat>
        <StatLabel>vs last cycle</StatLabel>
        {detail.deltaPct == null ? (
          <>
            <StatValue className={cn(MONEY_VALUE, "text-muted-foreground")}>
              —
            </StatValue>
            <StatDescription>nothing spent last cycle</StatDescription>
          </>
        ) : (
          <>
            <StatValue
              className={cn(
                MONEY_VALUE,
                "flex items-center gap-1",
                // The arrow shows the direction; the colour shows whether that
                // direction is good, which for SAVINGS is the opposite.
                favourable ? TONE.positive : TONE.negative,
              )}
            >
              {up ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
              {up ? "+" : ""}
              {Math.round(detail.deltaPct)}%
            </StatValue>
            <StatDescription>was {money(detail.prevSpend)}</StatDescription>
          </>
        )}
      </Stat>
    </div>
  );
}
