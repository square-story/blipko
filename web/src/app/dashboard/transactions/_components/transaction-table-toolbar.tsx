"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TransactionTableToolbarProps<TData> {
    table: Table<TData>;
}

export function TransactionTableToolbar<TData>({
    table,
}: TransactionTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0;

    return (
        <DataTableAdvancedToolbar table={table}>
            <Input
                placeholder="Filter transactions..."
                value={(table.getState().globalFilter as string) ?? ""}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className="h-8 w-[150px] lg:w-[250px]"
            />
            {table.getColumn("intent") && (
                <DataTableFacetedFilter
                    column={table.getColumn("intent")}
                    title="Type"
                    options={[
                        { label: "Credit", value: "CREDIT" },
                        { label: "Debit", value: "DEBIT" },
                        { label: "Undo", value: "UNDO" },
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
            {table.getColumn("date") && (
                <DataTableDateFilter
                    column={table.getColumn("date")!}
                    title="Date"
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
        </DataTableAdvancedToolbar>
    );
}
