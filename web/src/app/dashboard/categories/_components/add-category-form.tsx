"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { Plus } from "lucide-react";
import { Bucket } from "@prisma/client";
import { createCategory } from "@/lib/actions/categories";
import { BUCKETS, BUCKET_META } from "@/lib/budget";
import { toast } from "@/lib/toast";
import { resolveCategoryEmoji } from "@/lib/category-emoji";
import { EmojiPickerField } from "./emoji-picker-field";

interface AddCategoryFormProps {
  onAdded: () => void;
}

export const AddCategoryForm = ({ onAdded }: AddCategoryFormProps) => {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState<Bucket>("NEEDS");
  const [fixed, setFixed] = useState(false);
  const [amount, setAmount] = useState("");
  const [pickedIcon, setPickedIcon] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Auto-suggest an emoji from the name; a manual pick overrides it.
  const icon = pickedIcon ?? resolveCategoryEmoji(name);

  const reset = () => {
    setName("");
    setBucket("NEEDS");
    setFixed(false);
    setAmount("");
    setPickedIcon(null);
    setError("");
  };

  const handleAdd = () =>
    startTransition(async () => {
      const amt = Number(amount);
      if (fixed && (!amount.trim() || !Number.isFinite(amt) || amt < 0)) {
        setError("Enter a valid monthly amount");
        return;
      }
      const res = await createCategory(
        name,
        bucket,
        fixed ? { monthlyBudget: amt, locked: true, icon } : { icon },
      );
      if (!res.success) {
        toast.error(res.message ?? "Failed to add category");
        setError(res.message ?? "Failed to add");
        return;
      }
      toast.success(`"${name.trim()}" added`);
      reset();
      setOpen(false);
      onAdded();
    });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) reset();
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add a category
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>New Category</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Create a category to track your spending.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="space-y-4 px-4 pb-2 sm:px-0">
          <div className="space-y-1">
            <Label htmlFor="new-cat-name">Name</Label>
            <div className="flex items-center gap-2">
              <EmojiPickerField value={icon} onChange={setPickedIcon} />
              <Input
                id="new-cat-name"
                className="flex-1"
                value={name}
                placeholder="e.g. Gym"
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" && name.trim() && handleAdd()
                }
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Bucket</Label>
            <Select
              value={bucket}
              onValueChange={(v) => setBucket(v as Bucket)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUCKETS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BUCKET_META[b].emoji} {BUCKET_META[b].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="fixed-toggle">Set a fixed monthly limit</Label>
              <p className="text-xs text-muted-foreground">
                Pin an amount Auto-balance won&apos;t change.
              </p>
            </div>
            <Switch
              id="fixed-toggle"
              checked={fixed}
              onCheckedChange={(v) => {
                setFixed(v);
                setError("");
              }}
            />
          </div>
          {fixed && (
            <div className="space-y-1">
              <Label htmlFor="fixed-amount">Monthly limit</Label>
              <Input
                id="fixed-amount"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="2000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <ResponsiveModalFooter>
          <Button
            onClick={handleAdd}
            disabled={isPending || !name.trim()}
            className="flex-1"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
