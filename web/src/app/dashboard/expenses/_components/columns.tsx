"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ExpenseData } from "@/lib/actions/expenses";
import type { CategoryStat } from "@/lib/actions/categories";
import { BUCKET_META, formatMoney } from "@/lib/budget";
import { ExpenseRowActions } from "./expense-row-actions";

export function getExpenseColumns(
    categories: CategoryStat[],
): ColumnDef<ExpenseData>[] {
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
            <div className="text-right font-medium">
                {formatMoney(row.getValue("amount"))}
            </div>
        ),
    },
    {
        accessorKey: "bucket",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Bucket" />
        ),
        cell: ({ row }) => {
            const bucket = row.getValue("bucket") as keyof typeof BUCKET_META;
            const meta = BUCKET_META[bucket];
            return (
                <Badge variant="secondary">
                    {meta.emoji} {meta.label}
                </Badge>
            );
        },
        filterFn: "arrIncludesSome",
    },
    {
        accessorKey: "categoryName",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Category" />
        ),
        cell: ({ row }) => {
            const name = row.original.categoryName;
            return name ? (
                <Badge variant="outline">{name}</Badge>
            ) : (
                <span className="text-muted-foreground">—</span>
            );
        },
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
                <ExpenseRowActions expense={row.original} categories={categories} />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    ];
}
