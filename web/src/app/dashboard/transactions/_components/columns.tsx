"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { TransactionData } from "@/lib/actions/transactions";
import Link from "next/link";

export const columns: ColumnDef<TransactionData>[] = [
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
        accessorKey: "description",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Description" />
        ),
        cell: ({ row }) => (
            <div className="font-medium">{row.getValue("description") || "-"}</div>
        ),
    },
    {
        accessorKey: "contact",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Contact" />
        ),
        cell: ({ row }) => {
            const contactName = row.original.contactName;
            const contactId = row.original.contactId;

            if (!contactName) return <span className="text-muted-foreground">-</span>;

            return contactId ? (
                <Link
                    href={`/dashboard/vendors/${contactId}`}
                    className="hover:underline text-primary"
                >
                    {contactName}
                </Link>
            ) : (
                <span>{contactName}</span>
            );
        },
    },
    {
        accessorKey: "category",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Category" />
        ),
        cell: ({ row }) => (
            <Badge variant="secondary">{row.getValue("category")}</Badge>
        ),
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Amount" />
        ),
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("amount"));
            const intent = row.original.intent;
            const isCredit = intent === "CREDIT";
            const isDebit = intent === "DEBIT";

            return (
                <div
                    className={`font-medium ${isCredit ? "text-green-600" : isDebit ? "text-red-600" : ""
                        }`}
                >
                    {amount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: "intent",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Type" />
        ),
        cell: ({ row }) => {
            const intent = row.getValue("intent") as string;
            return (
                <Badge
                    variant={
                        intent === "CREDIT"
                            ? "default"
                            : intent === "DEBIT"
                                ? "destructive"
                                : "secondary"
                    }
                >
                    {intent}
                </Badge>
            );
        },
        filterFn: "arrIncludesSome",
    },
];
