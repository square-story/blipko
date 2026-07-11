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
  type BoxView,
} from "@/lib/actions/boxes";
import { formatMoney } from "@/lib/budget";
import { toast } from "@/lib/toast";

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
        kind === "expense"
          ? await moveExpenseToBox(transactionId, boxId, trimmed)
          : await moveIncomeToBox(transactionId, boxId, trimmed);
      if (!res.success) {
        toast.error(res.error ?? "Failed to move");
        return;
      }
      toast.success(`Moved to "${res.boxName}"`);
      handleOpenChange(false);
      router.refresh();
    });
  };

  const hasBoxes = boxes !== null && boxes.length > 0;

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Move to box</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Moving {formatMoney(amount)} out of your budget and into a box.
            {kind === "expense"
              ? " Recorded as a withdrawal (OUT)."
              : " Recorded as a contribution (IN)."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

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
                placeholder="reason for moving"
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
            Move
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
