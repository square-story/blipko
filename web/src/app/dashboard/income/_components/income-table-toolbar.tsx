"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableDateFilter } from "@/components/data-table/data-table-date-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { toast } from "sonner";
import { SlotLabel } from "@/components/ui/slot-label";
import { useTransientFlag } from "@/hooks/use-transient-flag";
import { exportIncomeCsv, type IncomeFilters } from "@/lib/actions/income";

interface IncomeTableToolbarProps<TData> {
  table: Table<TData>;
  filters: IncomeFilters;
}

export function IncomeTableToolbar<TData>({
  table,
  filters,
}: IncomeTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const [isExporting, startExport] = React.useTransition();
  const [exported, flashExported] = useTransientFlag();

  const handleExport = () =>
    startExport(async () => {
      const res = await exportIncomeCsv(filters);
      if (!res.success || !res.csv) {
        toast.error(res.message ?? "Failed to export");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `income-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      flashExported();
    });

  return (
    <DataTableAdvancedToolbar table={table}>
      <Input
        placeholder="Filter income..."
        value={(table.getState().globalFilter as string) ?? ""}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
        className="h-8 w-[150px] lg:w-[250px]"
      />
      {table.getColumn("date") && (
        <DataTableDateFilter column={table.getColumn("date")!} title="Date" />
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
        <SlotLabel
          text={isExporting ? "Exporting…" : exported ? "Exported" : "Export CSV"}
        />
      </Button>
    </DataTableAdvancedToolbar>
  );
}
