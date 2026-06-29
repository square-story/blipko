"use client";

import { useState, useTransition } from "react";
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
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { Bucket } from "@prisma/client";
import {
  renameCategory,
  setCategoryBucket,
  setCategoryBudget,
  type CategoryStat,
} from "@/lib/actions/categories";
import { BUCKETS, BUCKET_META } from "@/lib/budget";
import { toast } from "@/lib/toast";

interface EditCategoryModalProps {
  category: CategoryStat | null;
  onClose: () => void;
  onSaved: () => void;
}

export const EditCategoryModal = ({
  category,
  onClose,
  onSaved,
}: EditCategoryModalProps) => {
  const [isPending, startTransition] = useTransition();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBucket, setEditBucket] = useState<Bucket>("NEEDS");
  const [editBudget, setEditBudget] = useState("");
  const [error, setError] = useState("");

  // Sync the form when a different category is opened (and reset the tracker on
  // close). This adjusts state during render on a prop change — the recommended
  // pattern that avoids a setState-in-effect cascade.
  if (!category && trackedId !== null) setTrackedId(null);
  if (category && category.id !== trackedId) {
    setTrackedId(category.id);
    setEditName(category.name);
    setEditBucket(category.bucket);
    setEditBudget(
      category.monthlyBudget == null ? "" : String(category.monthlyBudget),
    );
    setError("");
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleSave = () =>
    startTransition(async () => {
      if (!category) return;
      if (editName.trim() !== category.name) {
        const r = await renameCategory(category.id, editName);
        if (!r.success) {
          toast.error(r.message ?? "Failed to rename");
          return setError(r.message ?? "Failed to rename");
        }
      }
      if (editBucket !== category.bucket) {
        const r = await setCategoryBucket(category.id, editBucket);
        if (!r.success) {
          toast.error(r.message ?? "Failed to change bucket");
          return setError(r.message ?? "Failed to change bucket");
        }
      }
      const trimmed = editBudget.trim();
      const nextBudget = trimmed === "" ? null : Number(trimmed);
      if (nextBudget !== category.monthlyBudget) {
        const r = await setCategoryBudget(category.id, nextBudget);
        if (!r.success) {
          toast.error(r.message ?? "Failed to set budget");
          return setError(r.message ?? "Failed to set budget");
        }
      }
      toast.success(`"${editName.trim()}" updated`);
      onSaved();
    });

  return (
    <ResponsiveModal open={!!category} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit Category</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update name, bucket, or monthly limit.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="space-y-4 px-4 pb-2 sm:px-0">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setError("");
              }}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Bucket</Label>
            <Select
              value={editBucket}
              onValueChange={(v) => setEditBucket(v as Bucket)}
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
          <div className="space-y-1">
            <Label>Monthly limit (optional)</Label>
            <Input
              type="number"
              min={0}
              value={editBudget}
              placeholder="No limit"
              onChange={(e) => {
                setEditBudget(e.target.value);
                setError("");
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <ResponsiveModalFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || !editName.trim()}
            className="flex-1"
          >
            Save
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
