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
import { IncomeData, deleteIncome } from "@/lib/actions/income";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface IncomeTableFloatingBarProps {
  table: Table<IncomeData>;
}

export function IncomeTableFloatingBar({ table }: IncomeTableFloatingBarProps) {
  const [isPending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleDelete = React.useCallback(() => {
    startTransition(async () => {
      const selectedRows = table.getFilteredSelectedRowModel().rows;
      const ids = selectedRows.map((row) => row.original.id);

      const result = await deleteIncome(ids);
      if (result.success) {
        toast.success(
          `Deleted ${ids.length} income row${ids.length !== 1 ? "s" : ""}`,
        );
      } else {
        toast.error(result.message ?? "Failed to delete");
      }
      table.toggleAllRowsSelected(false);
    });
  }, [table]);

  return (
    <DataTableActionBar table={table}>
      <DataTableActionBarSelection table={table} />
      <DataTableActionBarAction
        onClick={() => setConfirmOpen(true)}
        isPending={isPending}
        className="text-red-600 hover:bg-red-600/10 hover:text-red-700"
        tooltip="Delete income"
      >
        <Trash className="size-4" />
        <span className="sr-only">Delete</span>
      </DataTableActionBarAction>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete selected income?"
        description="The selected income rows will be removed. This can't be undone."
        onConfirm={handleDelete}
      />
    </DataTableActionBar>
  );
}
