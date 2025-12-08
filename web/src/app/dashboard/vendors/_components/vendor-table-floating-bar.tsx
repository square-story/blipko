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
import { VendorData } from "./schema";
import { deleteVendor } from "@/lib/actions/vendors";

interface VendorTableFloatingBarProps {
    table: Table<VendorData>;
}

export function VendorTableFloatingBar({
    table,
}: VendorTableFloatingBarProps) {
    const [isPending, startTransition] = React.useTransition();

    const handleAction = React.useCallback(
        (action: "delete") => {
            startTransition(async () => {
                const selectedRows = table.getFilteredSelectedRowModel().rows;
                const ids = selectedRows.map((row) => row.original.id);

                // Loop delete for now as bulk delete API might not exist
                try {
                    await Promise.all(ids.map(id => deleteVendor(id)));
                    toast.success(`${ids.length} vendors deleted successfully`);
                } catch (e) {
                    toast.error("Failed to delete some vendors");
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
                tooltip="Delete vendors"
            >
                <Trash className="size-4" />
                <span className="sr-only">Delete</span>
            </DataTableActionBarAction>
        </DataTableActionBar>
    );
}
