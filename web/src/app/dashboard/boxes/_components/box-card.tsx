"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/budget";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Plus,
  Minus,
} from "lucide-react";
import {
  deleteBox,
  archiveBox,
  type BoxView,
} from "@/lib/actions/boxes";
import type { CategoryStat } from "@/lib/actions/categories";
import { BoxFormModal } from "./box-form-modal";
import { BoxEntryModal } from "./box-entry-modal";
import { toast } from "@/lib/toast";

const money = (n: number) => formatMoney(n);

interface BoxCardProps {
  box: BoxView;
  categories: CategoryStat[];
  onChanged: () => void;
}

export function BoxCard({ box, categories, onChanged }: BoxCardProps) {
  const [, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const hasTarget = box.targetAmount != null && box.targetAmount > 0;
  const target = box.targetAmount ?? 0;
  const reached = hasTarget && box.balance >= target;
  const pct = hasTarget ? (box.balance / target) * 100 : 0;
  const remaining = target - box.balance;

  const ringColor = reached
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-primary";

  const remove = () => {
    startTransition(async () => {
      const res = await deleteBox(box.id);
      if (res.success) {
        toast.success("Box deleted");
        onChanged();
      } else toast.error("Failed to delete box");
    });
  };

  const setArchived = (archived: boolean, undo = false) => {
    startTransition(async () => {
      const res = await archiveBox(box.id, archived);
      if (!res.success) {
        toast.error(archived ? "Failed to archive box" : "Failed to restore box");
        return;
      }
      if (archived) {
        toast.success("Box archived", {
          action: { label: "Undo", onClick: () => setArchived(false, true) },
        });
      } else if (!undo) {
        toast.success("Box restored");
      }
      onChanged();
    });
  };

  const archive = () => setArchived(true);
  const restore = () => setArchived(false);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-card border shadow-sm hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/dashboard/boxes/${box.id}`}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
        >
          {hasTarget ? (
            <CircularProgress value={pct} size={52} strokeWidth={4} color={ringColor} />
          ) : (
            <div className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-muted/50 text-xl shrink-0">
              {box.icon || "📦"}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">
                {box.icon && hasTarget ? `${box.icon} ` : ""}
                {box.name}
              </span>
              {box.isArchived && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal shrink-0">
                  Archived
                </Badge>
              )}
            </div>
            {box.categoryName && (
              <Badge variant="outline" className="mt-0.5 w-fit text-[10px] h-4 px-1.5 font-normal">
                🔗 {box.categoryName}
              </Badge>
            )}
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <BoxFormModal
              box={box}
              categories={categories}
              onSaved={onChanged}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
              }
            />
            {box.isArchived ? (
              <DropdownMenuItem onClick={restore}>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={archive}>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${box.name}"?`}
        description="The box and all its entries will be removed. This can't be undone."
        onConfirm={remove}
      />

      <div>
        <div className="text-2xl font-bold text-foreground">{money(box.balance)}</div>
        <div
          className={cn(
            "text-xs font-medium mt-0.5",
            reached
              ? "text-emerald-600 dark:text-emerald-500"
              : "text-muted-foreground",
          )}
        >
          {hasTarget
            ? reached
              ? `🎉 Target reached · ${money(target)}`
              : `${money(remaining)} to go · target ${money(target)}`
            : "Open fund"}
        </div>
      </div>

      {!box.isArchived && (
        <div className="flex items-center gap-2">
          <BoxEntryModal
            box={box}
            mode="IN"
            onSaved={onChanged}
            trigger={
              <Button size="sm" variant="outline" className="flex-1 text-green-600">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            }
          />
          <BoxEntryModal
            box={box}
            mode="OUT"
            onSaved={onChanged}
            trigger={
              <Button size="sm" variant="outline" className="flex-1">
                <Minus className="mr-1 h-3.5 w-3.5" /> Spend
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
