"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { IncomeData } from "@/lib/actions/income";
import type { CategoryStat } from "@/lib/actions/categories";
import { formatMoney } from "@/lib/budget";
import { resolveCategoryEmoji } from "@/lib/category-emoji";
import { IncomeRowActions } from "./income-row-actions";

export function getIncomeColumns(
  categories: CategoryStat[],
): ColumnDef<IncomeData>[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-0.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-0.5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue("date") as Date;
        return <div>{new Date(date).toLocaleDateString()}</div>;
      },
      filterFn: "inNumberRange",
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} label="Amount" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium text-green-600">
          +{formatMoney(row.getValue("amount"))}
        </div>
      ),
    },
    {
      id: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Category" />
      ),
      cell: ({ row }) => {
        const inc = row.original;
        if (!inc.categoryId) {
          return <span className="text-muted-foreground">—</span>;
        }
        const cat = catById.get(inc.categoryId);
        const emoji =
          cat?.icon ?? resolveCategoryEmoji(cat?.name ?? inc.categoryName ?? "");
        return (
          <div className="flex items-center gap-1.5">
            <span>{emoji}</span>
            <span className="max-w-[160px] truncate">
              {inc.categoryName ?? "—"}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "note",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Note" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[240px] truncate">
          {row.getValue("note") || "—"}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <IncomeRowActions income={row.original} categories={categories} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
