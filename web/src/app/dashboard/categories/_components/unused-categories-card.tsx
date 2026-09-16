"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  getUnusedCategories,
  deleteUnusedCategories,
  type UnusedCategory,
} from "@/lib/actions/categories";
import { toast } from "@/lib/toast";

// Onboarding used to create ~21 categories for every new account whether or not
// the user wanted them. It no longer does — this offers to clear the leftovers.
// Never automatic: deleting a category someone deliberately pre-created and
// budgeted for would be worse than leaving a few stale rows.
const DISMISS_KEY = "blipko:unused-categories-dismissed";

export function UnusedCategoriesCard({ onCleaned }: { onCleaned: () => void }) {
  const [unused, setUnused] = useState<UnusedCategory[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // localStorage only — a User column for a dismissable hint is not worth a
    // migration. Read in an effect because it does not exist during SSR, and
    // bail out rather than setState synchronously here (cascading renders).
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    void getUnusedCategories().then(setUnused);
  }, []);

  if (dismissed || unused.length === 0) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const remove = () =>
    startTransition(async () => {
      const res = await deleteUnusedCategories(unused.map((c) => c.id));
      if (!res.success) {
        toast.error(res.message ?? "Could not remove them");
        return;
      }
      toast.success(
        res.deleted === 0
          ? "Nothing left to remove"
          : `Removed ${res.deleted} unused ${res.deleted === 1 ? "category" : "categories"}`,
      );
      setUnused([]);
      onCleaned();
    });

  const names = unused.map((c) => c.name).join(", ");
  const preview = unused
    .slice(0, 6)
    .map((c) => c.name)
    .join(" · ");

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {unused.length}{" "}
            {unused.length === 1 ? "category has" : "categories have"} never
            been used
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {preview}
            {unused.length > 6 && ` · +${unused.length - 6} more`}
          </p>
        </div>
        <ConfirmDialog
          onConfirm={remove}
          title={`Remove ${unused.length} unused ${unused.length === 1 ? "category" : "categories"}?`}
          description={`${names}. None of these have any spending, recurring rule, or box attached. Anything you've actually used is untouched.`}
          confirmLabel="Remove"
          trigger={
            <Button variant="outline" size="sm" disabled={isPending}>
              Review &amp; remove
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss"
          className="size-8 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
