"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { toast } from "@/lib/toast";
import {
    exportExpensesCsv,
    type ExpenseFilters,
} from "@/lib/actions/expenses";
import { BUCKETS, BUCKET_META } from "@/lib/budget";

interface ExpenseTableToolbarProps<TData> {
    table: Table<TData>;
    categoryOptions: { label: string; value: string }[];
    filters: ExpenseFilters;
}

export function ExpenseTableToolbar<TData>({
    table,
    categoryOptions,
    filters,
}: ExpenseTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0;
    const [isExporting, startExport] = React.useTransition();

    const handleExport = () =>
        startExport(async () => {
            const res = await exportExpensesCsv(filters);
            if (!res.success || !res.csv) {
                toast.error(res.message ?? "Failed to export");
                return;
            }
            const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });

    return (
        <DataTableAdvancedToolbar table={table}>
            <Input
                placeholder="Filter expenses..."
                value={(table.getState().globalFilter as string) ?? ""}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className="h-8 w-[150px] lg:w-[250px]"
            />
            {table.getColumn("bucket") && (
                <DataTableFacetedFilter
                    column={table.getColumn("bucket")}
                    title="Bucket"
                    options={BUCKETS.map((b) => ({
                        label: BUCKET_META[b].label,
                        value: b,
                    }))}
                />
            )}
            {table.getColumn("categoryName") && categoryOptions.length > 0 && (
                <DataTableFacetedFilter
                    column={table.getColumn("categoryName")}
                    title="Category"
                    options={categoryOptions}
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
            <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8"
                onClick={handleExport}
                disabled={isExporting}
            >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
            </Button>
        </DataTableAdvancedToolbar>
    );
}
