"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";

interface ConfirmDialogProps {
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  // Red confirm button (deletes etc.); pass false for a neutral action.
  destructive?: boolean;
  // Uncontrolled: render this element as the trigger.
  trigger?: React.ReactNode;
  // Controlled: drive open state from the parent (e.g. a toolbar button).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Confirmation gate. Pass either a `trigger` element or controlled
// `open`/`onOpenChange`. Destructive by default (red confirm button).
export function ConfirmDialog({
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  destructive = true,
  trigger,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              playSound("confirm");
              onConfirm();
            }}
            className={cn(
              destructive && "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
