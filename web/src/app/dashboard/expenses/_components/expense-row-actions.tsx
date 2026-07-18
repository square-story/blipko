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
import { deleteExpenses, type ExpenseData } from "@/lib/actions/expenses";
import type { CategoryStat } from "@/lib/actions/categories";
import { toast } from "@/lib/toast";
import { EditExpenseModal } from "./edit-expense-modal";
import { MoveToBoxModal } from "@/app/dashboard/_components/move-to-box-modal";

interface ExpenseRowActionsProps {
  expense: ExpenseData;
  categories: CategoryStat[];
}

export function ExpenseRowActions({ expense, categories }: ExpenseRowActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteExpenses([expense.id]);
      if (!res.success) {
        toast.error(res.message ?? "Failed to delete expense");
        return;
      }
      toast.success("Expense deleted");
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
            Move / track to box…
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

      <EditExpenseModal
        expense={expense}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <MoveToBoxModal
        kind="expense"
        transactionId={expense.id}
        amount={expense.amount}
        note={expense.note}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete this expense?"
        description="This will remove the expense from your dashboard."
      />
    </>
  );
}
