"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { VendorData } from "./schema";
import { VendorRowActions } from "./vendor-row-actions";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

export const columns: ColumnDef<VendorData>[] = [
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
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Vendor Name" />
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "category",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Category" />
        ),
    },
    {
        accessorKey: "status",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
                    {status}
                </Badge>
            );
        },
    },
    {
        accessorKey: "totalSpend",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => {
                    // Special handling for totalSpend as API expects "totalSpend.asc/desc"
                    // But DataTableColumnHeader toggles standard sorting.
                    // If we use standard sort, id is totalSpend.
                    column.toggleSorting(column.getIsSorted() === "asc")
                }}
                className="-ml-4"
            >
                Total Spend
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalSpend"));
            return (
                <div className="font-medium">
                    {amount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: "lastTransaction",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Last Transaction" />
        ),
        cell: ({ row }) => {
            const date = row.getValue("lastTransaction") as Date | undefined;
            return date ? new Date(date).toLocaleDateString() : "N/A";
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <VendorRowActions row={row} />,
    },
];
