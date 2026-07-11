"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Table } from "@tanstack/react-table";
import { Trash } from "lucide-react";
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/lib/toast";
import { deleteBoxEntries, type BoxEntryView } from "@/lib/actions/boxes";

export function BoxEntriesFloatingBar({ table }: { table: Table<BoxEntryView> }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleDelete = React.useCallback(() => {
    startTransition(async () => {
      const ids = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original.id);
      const result = await deleteBoxEntries(ids);
      if (result.success) {
        toast.success(`Deleted ${ids.length} entr${ids.length !== 1 ? "ies" : "y"}`);
      } else {
        toast.error(result.message ?? "Failed to delete");
      }
      table.toggleAllRowsSelected(false);
      router.refresh();
    });
  }, [table, router]);

  return (
    <DataTableActionBar table={table}>
      <DataTableActionBarSelection table={table} />
      <DataTableActionBarAction
        onClick={() => setConfirmOpen(true)}
        isPending={isPending}
        className="text-red-600 hover:bg-red-600/10 hover:text-red-700"
        tooltip="Delete entries"
      >
        <Trash className="size-4" />
        <span className="sr-only">Delete</span>
      </DataTableActionBarAction>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete selected entries?"
        description="The selected entries will be removed from the box. This can't be undone."
        onConfirm={handleDelete}
      />
    </DataTableActionBar>
  );
}
