"use client";

import type { Table } from "@tanstack/react-table";
import { Trash } from "lucide-react";
import * as React from "react";

import {
    DataTableActionBar,
    DataTableActionBarAction,
    DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar";
import { toast } from "sonner";
import { TransactionData, deleteTransactions } from "@/lib/actions/transactions";

interface TransactionTableFloatingBarProps {
    table: Table<TransactionData>;
}

export function TransactionTableFloatingBar({
    table,
}: TransactionTableFloatingBarProps) {
    const [isPending, startTransition] = React.useTransition();

    const handleAction = React.useCallback(
        (action: "delete") => {
            startTransition(async () => {
                const selectedRows = table.getFilteredSelectedRowModel().rows;
                const ids = selectedRows.map((row) => row.original.id);

                const result = await deleteTransactions(ids);
                if (result.success) {
                    toast.success(`Deleted ${ids.length} transaction${ids.length !== 1 ? "s" : ""}`);
                } else {
                    toast.error(result.message ?? "Failed to delete");
                }
                table.toggleAllRowsSelected(false);
            });
        },
        [table]
    );

    return (
        <DataTableActionBar table={table}>
            <DataTableActionBarSelection table={table} />
            <DataTableActionBarAction
                onClick={() => handleAction("delete")}
                isPending={isPending}
                className="text-red-600 hover:bg-red-600/10 hover:text-red-700"
                tooltip="Delete transactions"
            >
                <Trash className="size-4" />
                <span className="sr-only">Delete</span>
            </DataTableActionBarAction>
        </DataTableActionBar>
    );
}
