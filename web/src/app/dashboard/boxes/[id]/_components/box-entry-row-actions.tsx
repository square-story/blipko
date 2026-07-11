"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  deleteBoxEntry,
  moveBoxEntryBackToBudget,
  type BoxEntryView,
} from "@/lib/actions/boxes";
import { toast } from "@/lib/toast";

export function BoxEntryRowActions({ entry }: { entry: BoxEntryView }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveBackOpen, setMoveBackOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteBoxEntry(entry.id);
      if (!res.success) {
        toast.error("Failed to delete entry");
        return;
      }
      toast.success("Entry deleted");
      router.refresh();
    });
  };

  const onMoveBack = () => {
    startTransition(async () => {
      const res = await moveBoxEntryBackToBudget(entry.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to move back");
        return;
      }
      toast.success("Moved back to budget");
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {entry.movedFrom && (
            <DropdownMenuItem onSelect={() => setMoveBackOpen(true)}>
              Move back to budget
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={moveBackOpen}
        onOpenChange={setMoveBackOpen}
        onConfirm={onMoveBack}
        title="Move back to budget?"
        description="This restores the original transaction to your budget and removes this box entry."
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete this entry?"
        description="This will remove the entry from the box. This can't be undone."
      />
    </>
  );
}
