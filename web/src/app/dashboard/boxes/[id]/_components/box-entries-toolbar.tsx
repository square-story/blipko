"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { X, Download } from "lucide-react";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { exportBoxEntriesCsv, type BoxEntryFilters } from "@/lib/actions/boxes";

const DIRECTION_OPTIONS = [
  { label: "In", value: "IN" },
  { label: "Out", value: "OUT" },
];

interface BoxEntriesToolbarProps<TData> {
  table: Table<TData>;
  filters: BoxEntryFilters;
}

export function BoxEntriesToolbar<TData>({
  table,
  filters,
}: BoxEntriesToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const [isExporting, startExport] = React.useTransition();

  const handleExport = () =>
    startExport(async () => {
      const res = await exportBoxEntriesCsv(filters);
      if (!res.success || !res.csv) {
        toast.error(res.message ?? "Failed to export");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `box-entries-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <DataTableAdvancedToolbar table={table}>
      <Input
        placeholder="Search notes..."
        value={(table.getState().globalFilter as string) ?? ""}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
        className="h-8 w-[150px] lg:w-[250px]"
      />
      {table.getColumn("direction") && (
        <DataTableFacetedFilter
          column={table.getColumn("direction")}
          title="Direction"
          options={DIRECTION_OPTIONS}
          multiple
        />
      )}
      {table.getColumn("date") && (
        <DataTableDateFilter
          column={table.getColumn("date")!}
          title="Date"
          multiple
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
