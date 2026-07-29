import { formatMoney } from "@/lib/budget";

interface DataTableAmountTotalsProps {
  // Sum of the rows on the current page.
  pageTotal: number;
  // Row count and amount for every row matching the active filters.
  total: number;
  totalAmount: number;
}

export function DataTableAmountTotals({
  pageTotal,
  total,
  totalAmount,
}: DataTableAmountTotalsProps) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      Page{" "}
      <span className="font-medium text-foreground">
        {formatMoney(pageTotal)}
      </span>
      {" · "}
      All {total}{" "}
      <span className="font-medium text-foreground">
        {formatMoney(totalAmount)}
      </span>
    </span>
  );
}
