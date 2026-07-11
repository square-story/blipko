"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteIncome, type IncomeData } from "@/lib/actions/income";
import { toast } from "@/lib/toast";
import { EditIncomeModal } from "./edit-income-modal";
import { MoveToBoxModal } from "@/app/dashboard/_components/move-to-box-modal";

interface IncomeRowActionsProps {
  income: IncomeData;
}

export function IncomeRowActions({ income }: IncomeRowActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteIncome([income.id]);
      if (!res.success) {
        toast.error(res.message ?? "Failed to delete income");
        return;
      }
      toast.success("Income deleted");
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
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
            Move to box…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditIncomeModal
        income={income}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <MoveToBoxModal
        kind="income"
        transactionId={income.id}
        amount={income.amount}
        note={income.note}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete this income?"
        description="This will remove the income entry from your dashboard."
      />
    </>
  );
}
