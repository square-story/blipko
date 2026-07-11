"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { BoxEntryView } from "@/lib/actions/boxes";
import { formatMoney } from "@/lib/budget";
import { BoxEntryRowActions } from "./box-entry-row-actions";

export const boxEntriesColumns: ColumnDef<BoxEntryView>[] = [
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
    header: ({ column }) => <DataTableColumnHeader column={column} label="Date" />,
    cell: ({ row }) => (
      <div>{new Date(row.getValue("date") as Date).toLocaleDateString()}</div>
    ),
    filterFn: "inNumberRange",
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} label="Amount" />
      </div>
    ),
    cell: ({ row }) => {
      const isIn = row.original.direction === "IN";
      return (
        <div
          className={`text-right font-medium ${isIn ? "text-green-600" : "text-red-600"}`}
        >
          {isIn ? "+" : "−"}
          {formatMoney(row.getValue("amount"))}
        </div>
      );
    },
  },
  {
    accessorKey: "direction",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Direction" />
    ),
    cell: ({ row }) => {
      const isIn = row.getValue("direction") === "IN";
      return (
        <Badge variant="outline" className="font-normal">
          {isIn ? "⬆ In" : "⬇ Out"}
        </Badge>
      );
    },
    filterFn: "arrIncludesSome",
    enableSorting: false,
  },
  {
    accessorKey: "source",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Source" />
    ),
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {row.getValue("source") === "LINKED" ? "🔗 Linked" : "Manual"}
        {row.original.movedFrom && (
          <Badge variant="outline" className="font-normal">
            from budget
          </Badge>
        )}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "note",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Note" />,
    cell: ({ row }) => (
      <div className="max-w-[240px] truncate">{row.getValue("note") || "—"}</div>
    ),
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <BoxEntryRowActions entry={row.original} />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];
