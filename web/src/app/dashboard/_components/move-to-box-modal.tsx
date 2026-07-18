"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBoxes,
  moveExpenseToBox,
  moveIncomeToBox,
  trackExpenseInBox,
  trackIncomeInBox,
  type BoxView,
} from "@/lib/actions/boxes";
import { formatMoney } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Mode = "move" | "track";

interface MoveToBoxModalProps {
  kind: "expense" | "income";
  transactionId: string;
  amount: number;
  note: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveToBoxModal({
  kind,
  transactionId,
  amount,
  note,
  open,
  onOpenChange,
}: MoveToBoxModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [boxes, setBoxes] = useState<BoxView[] | null>(null);
  const [boxId, setBoxId] = useState("");
  const [noteText, setNoteText] = useState(note ?? "");
  const [mode, setMode] = useState<Mode>("move");

  // Fetch active boxes whenever the modal opens (async-only setState).
  useEffect(() => {
    if (!open) return;
    let active = true;
    getBoxes(false).then((b) => {
      if (active) setBoxes(b);
    });
    return () => {
      active = false;
    };
  }, [open]);

  // Reset the picker when the modal closes, so a re-open starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBoxId("");
      setNoteText(note ?? "");
      setMode("move");
    }
    onOpenChange(next);
  };

  const onSubmit = () => {
    if (!boxId) {
      toast.error("Pick a box");
      return;
    }
    const trimmed = noteText.trim() || undefined;
    startTransition(async () => {
      const res =
        mode === "move"
          ? kind === "expense"
            ? await moveExpenseToBox(transactionId, boxId, trimmed)
            : await moveIncomeToBox(transactionId, boxId, trimmed)
          : kind === "expense"
            ? await trackExpenseInBox(transactionId, boxId, trimmed)
            : await trackIncomeInBox(transactionId, boxId, trimmed);
      if (!res.success) {
        toast.error(res.error ?? "Failed to save");
        return;
      }
      toast.success(
        mode === "move"
          ? `Moved to "${res.boxName}"`
          : `Tracked in "${res.boxName}"`,
      );
      handleOpenChange(false);
      router.refresh();
    });
  };

  const hasBoxes = boxes !== null && boxes.length > 0;

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Move or track</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {mode === "move"
              ? `Moving ${formatMoney(amount)} out of your budget and into a box.`
              : `Tracking ${formatMoney(amount)} against a box — it stays in your budget and counts toward the goal.`}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
          <Button
            type="button"
            variant={mode === "move" ? "default" : "ghost"}
            size="sm"
            className={cn("h-auto flex-col items-start gap-0.5 py-2 text-left")}
            onClick={() => setMode("move")}
          >
            <span className="text-sm font-medium">Move</span>
            <span
              className={cn(
                "text-[11px] font-normal",
                mode === "move"
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              Removes from budget
            </span>
          </Button>
          <Button
            type="button"
            variant={mode === "track" ? "default" : "ghost"}
            size="sm"
            className={cn("h-auto flex-col items-start gap-0.5 py-2 text-left")}
            onClick={() => setMode("track")}
          >
            <span className="text-sm font-medium">Track</span>
            <span
              className={cn(
                "text-[11px] font-normal",
                mode === "track"
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              Stays in budget
            </span>
          </Button>
        </div>

        {boxes === null ? (
          <p className="text-sm text-muted-foreground">Loading boxes…</p>
        ) : !hasBoxes ? (
          <p className="text-sm text-muted-foreground">
            No active boxes yet.{" "}
            <Link href="/dashboard/boxes" className="underline">
              Create a box
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Box</Label>
              <Select value={boxId} onValueChange={setBoxId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a box" />
                </SelectTrigger>
                <SelectContent>
                  {boxes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.icon ? `${b.icon} ` : ""}
                      {b.name} · {formatMoney(b.balance)}
                      {b.targetAmount
                        ? ` / ${formatMoney(b.targetAmount)}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="optional note"
              />
            </div>
          </div>
        )}

        <ResponsiveModalFooter>
          <Button
            onClick={onSubmit}
            disabled={isPending || !hasBoxes || !boxId}
            className="w-full sm:w-auto"
          >
            {mode === "move" ? "Move" : "Track"}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
