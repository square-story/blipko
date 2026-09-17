"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, PiggyBankIcon } from "lucide-react";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/budget";
import { settleCarryForward } from "@/lib/actions/carry";

export type CarryPrompt = {
  cycleKey: string;
  suggested: number;
  endedLabel: string;
};

const NO_BOX = "__none__";

// Asked once per cycle, on the dashboard, at the start of a new cycle: what
// happens to what last cycle left over. Mounts only because the server decided
// it should (getBudgetOverview → shouldPromptCarry), so there is no client-side
// "should I show?" logic — and no close button, because the money goes nowhere
// until it is answered.
export function CarryForwardPrompt({
  prompt,
  boxes,
  currency,
  locale,
}: {
  prompt: CarryPrompt;
  boxes: { id: string; name: string; icon: string | null }[];
  currency: string;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState(
    prompt.suggested > 0 ? String(prompt.suggested) : "",
  );
  const [boxId, setBoxId] = useState(NO_BOX);
  const [isPending, startTransition] = useTransition();

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const settle = (destination: "savings" | "opening") => {
    if (!valid) {
      toast.error("Enter an amount first");
      return;
    }
    startTransition(async () => {
      const res = await settleCarryForward({
        cycleKey: prompt.cycleKey,
        amount: parsed,
        destination,
        ...(destination === "savings" && boxId !== NO_BOX ? { boxId } : {}),
      });
      if (!res.success) {
        toast.error(res.message ?? "Could not carry that forward");
        return;
      }
      toast.success(
        destination === "savings"
          ? `${formatMoney(parsed, currency, locale)} moved to savings`
          : `${formatMoney(parsed, currency, locale)} carried into this cycle`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New cycle</DialogTitle>
          <DialogDescription>
            {prompt.suggested > 0 ? (
              <>
                {prompt.endedLabel} left you{" "}
                <span data-money>
                  {formatMoney(prompt.suggested, currency, locale)}
                </span>
                . Where should it go?
              </>
            ) : (
              `${prompt.endedLabel} has wrapped. Carrying anything into this cycle?`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carry-amount">Amount</Label>
            <Input
              id="carry-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Edit it if your actual balance differs from what was logged.
            </p>
          </div>

          {boxes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="carry-box">Box (savings only)</Label>
              <Select value={boxId} onValueChange={setBoxId}>
                <SelectTrigger id="carry-box">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BOX}>No box</SelectItem>
                  {boxes.map((box) => (
                    <SelectItem key={box.id} value={box.id}>
                      {box.icon ? `${box.icon} ` : ""}
                      {box.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => settle("savings")}
              disabled={isPending || !valid}
            >
              <PiggyBankIcon className="mr-2 size-4" />
              Move to savings
            </Button>
            <Button
              variant="secondary"
              onClick={() => settle("opening")}
              disabled={isPending || !valid}
            >
              <ArrowRightIcon className="mr-2 size-4" />
              Opening balance
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Savings files it as a savings expense. Opening balance adds it to
            this cycle&apos;s budget.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
