"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { VendorDialog } from "../vendor-dialog";

interface VendorTableToolbarProps<TData> {
    table: Table<TData>;
}

export function VendorTableToolbar<TData>({
    table,
}: VendorTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0;

    return (
        <DataTableAdvancedToolbar table={table}>
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder="Search vendors..."
                    value={(table.getState().globalFilter as string) ?? ""}
                    onChange={(event) => table.setGlobalFilter(event.target.value)}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
                {table.getColumn("status") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("status")}
                        title="Status"
                        options={[
                            { label: "Active", value: "ACTIVE" },
                            { label: "Inactive", value: "INACTIVE" },
                            { label: "Archived", value: "ARCHIVED" },
                        ]}
                    />
                )}
                {table.getColumn("category") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("category")}
                        title="Category"
                        options={[
                            { label: "General", value: "General" },
                        ]}
                    />
                )}
                {isFiltered && (
                    <Button
                        variant="ghost"
                        onClick={() => table.resetColumnFilters()}
                        className="h-8 px-2 lg:px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <VendorDialog />
            </div>
        </DataTableAdvancedToolbar>
    );
}
