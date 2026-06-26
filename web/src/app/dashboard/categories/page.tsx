"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Bucket } from "@prisma/client";
import {
  getCategories,
  createCategory,
  renameCategory,
  setCategoryBucket,
  setCategoryBudget,
  setCategoryBudgets,
  deleteCategory,
  type CategoryStat,
} from "@/lib/actions/categories";
import { getBudgetOverview } from "@/lib/actions/budget";
import {
  BUCKETS,
  BUCKET_META,
  formatMoney,
  categoryPacing,
  weightedBudgets,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Overview = Awaited<ReturnType<typeof getBudgetOverview>>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isPending, startTransition] = useTransition();

  // Add form
  const [newName, setNewName] = useState("");
  const [newBucket, setNewBucket] = useState<Bucket>("NEEDS");
  const [addError, setAddError] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<CategoryStat | null>(null);
  const [editName, setEditName] = useState("");
  const [editBucket, setEditBucket] = useState<Bucket>("NEEDS");
  const [editBudget, setEditBudget] = useState("");
  const [editError, setEditError] = useState("");

  const load = () =>
    startTransition(async () => {
      const [cats, ov] = await Promise.all([
        getCategories(),
        getBudgetOverview(),
      ]);
      setCategories(cats);
      setOverview(ov);
    });

  useEffect(() => {
    load();
  }, []);

  const currency = overview?.currency ?? "INR";
  const locale = overview?.locale ?? "en-IN";
  const money = (n: number) => formatMoney(n, currency, locale);
  const day = overview?.day ?? 1;
  const daysInPeriod = overview?.daysInPeriod ?? 30;
  const remainingDays = overview?.remainingDays ?? 1;

  // Group rows are organizational only — used to label children, not listed.
  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) if (c.isGroup) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const leaves = useMemo(
    () => categories.filter((c) => !c.isGroup),
    [categories],
  );

  const handleAdd = (bucket: Bucket = newBucket) =>
    startTransition(async () => {
      const res = await createCategory(newName, bucket);
      if (!res.success) {
        setAddError(res.message ?? "Failed to add");
        return;
      }
      setNewName("");
      setAddError("");
      load();
    });

  const openEdit = (cat: CategoryStat) => {
    setEditing(cat);
    setEditName(cat.name);
    setEditBucket(cat.bucket);
    setEditBudget(cat.monthlyBudget == null ? "" : String(cat.monthlyBudget));
    setEditError("");
  };

  const handleSaveEdit = () =>
    startTransition(async () => {
      if (!editing) return;
      if (editName.trim() !== editing.name) {
        const r = await renameCategory(editing.id, editName);
        if (!r.success) return setEditError(r.message ?? "Failed to rename");
      }
      if (editBucket !== editing.bucket) {
        const r = await setCategoryBucket(editing.id, editBucket);
        if (!r.success)
          return setEditError(r.message ?? "Failed to change bucket");
      }
      const trimmed = editBudget.trim();
      const nextBudget = trimmed === "" ? null : Number(trimmed);
      if (nextBudget !== editing.monthlyBudget) {
        const r = await setCategoryBudget(editing.id, nextBudget);
        if (!r.success) return setEditError(r.message ?? "Failed to set budget");
      }
      setEditing(null);
      load();
    });

  const handleDelete = (cat: CategoryStat) =>
    startTransition(async () => {
      await deleteCategory(cat.id);
      load();
    });

  // Distribute a bucket's budget across its categories weighted by recent spend
  // (falls back to current limits, then even). Explicit, confirmed — overwrites
  // current limits in that bucket.
  const autoBalance = (cats: CategoryStat[], budget: number) =>
    startTransition(async () => {
      const updates = weightedBudgets(cats, budget);
      if (updates.length === 0) return;
      await setCategoryBudgets(updates);
      load();
    });

  return (
    <ContentLayout title="Categories">
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Your spending split into 50/30/20 buckets. Each bucket is your budget
            for the month; a category limit is an optional cap the bot warns you
            about.
          </p>
          {overview?.periodLabel && (
            <p className="text-xs text-muted-foreground">
              This cycle: {overview.periodLabel}
            </p>
          )}
        </div>

        {/* Add a custom category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-cat">Name</Label>
                <Input
                  id="new-cat"
                  value={newName}
                  placeholder="e.g. Gym"
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setAddError("");
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" && newName.trim() && handleAdd()
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Bucket</Label>
                <Select
                  value={newBucket}
                  onValueChange={(v) => setNewBucket(v as Bucket)}
                >
                  <SelectTrigger className="w-40">
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
              <Button
                onClick={() => handleAdd()}
                disabled={isPending || !newName.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {addError && (
              <p className="mt-2 text-sm text-destructive">{addError}</p>
            )}
          </CardContent>
        </Card>

        {/* Empty state */}
        {leaves.length === 0 && !isPending && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No categories yet. Add one above to start tracking — the bot will
              also create them as you log spends.
            </CardContent>
          </Card>
        )}

        {/* One section per bucket: summary + its categories */}
        {leaves.length > 0 &&
          BUCKETS.map((bucket) => {
            const meta = BUCKET_META[bucket];
            const ov = overview?.buckets.find((b) => b.bucket === bucket);
            const budget = ov?.budget ?? 0;
            const spent = ov?.spent ?? 0;
            const remaining = ov?.remaining ?? 0;
            const pct = ov?.pct ?? 0;
            const over = remaining < 0;
            const inBucket = leaves.filter((c) => c.bucket === bucket);
            const allocated = inBucket.reduce(
              (s, c) => s + (c.monthlyBudget ?? 0),
              0,
            );
            const unallocated = budget - allocated;
            const overAllocated = unallocated < 0;

            return (
              <Card key={bucket}>
                <CardHeader className="pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle className="text-base">
                      {meta.emoji} {meta.label}
                    </CardTitle>
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        over ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {over
                        ? `${money(Math.abs(remaining))} over`
                        : `${money(remaining)} left`}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          over ? "bg-red-500" : "bg-primary",
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {money(spent)} spent of {money(budget)}
                      {budget > 0 && !over && (
                        <>
                          {" "}
                          · safe{" "}
                          {money(Math.max(0, remaining) / remainingDays)}/day
                        </>
                      )}
                    </p>
                  </div>
                  {inBucket.length > 0 && budget > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {money(allocated)} allocated ·{" "}
                        <span className={cn(overAllocated && "text-red-600")}>
                          {overAllocated
                            ? `${money(-unallocated)} over-allocated`
                            : `${money(unallocated)} unallocated`}
                        </span>
                      </p>
                      <ConfirmDialog
                        title={`Auto-balance ${meta.label}?`}
                        description={`Distribute ${money(budget)} across ${meta.label} weighted by your recent spending. This replaces their current limits.`}
                        confirmLabel="Auto-balance"
                        onConfirm={() => autoBalance(inBucket, budget)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-xs"
                            disabled={isPending}
                          >
                            Auto-balance
                          </Button>
                        }
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {inBucket.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No categories in this bucket yet.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {inBucket.map((cat) => {
                        const group = cat.parentId
                          ? groupNameById.get(cat.parentId)
                          : null;
                        const hasLimit = cat.monthlyBudget != null;
                        const left = hasLimit
                          ? cat.monthlyBudget! - cat.spend
                          : null;
                        const pace = categoryPacing({
                          spent: cat.spend,
                          limit: cat.monthlyBudget,
                          day,
                          daysInPeriod,
                          remainingDays,
                        });
                        return (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between gap-2 py-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {cat.name}
                                </span>
                                {group && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {group}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {money(cat.spend)} spent
                                {hasLimit && (
                                  <>
                                    {" "}
                                    of {money(cat.monthlyBudget!)} ·{" "}
                                    <span
                                      className={cn(
                                        left! < 0 && "text-red-600",
                                      )}
                                    >
                                      {left! < 0
                                        ? `${money(Math.abs(left!))} over`
                                        : `${money(left!)} left`}
                                    </span>
                                  </>
                                )}
                              </p>
                              {cat.spend > 0 && (
                                <p className="text-xs tabular-nums text-muted-foreground">
                                  ~{money(pace.dailyRate)}/day · ~
                                  {money(pace.weekly)}/wk
                                  {hasLimit && (
                                    <>
                                      {" · "}
                                      {pace.overSpent ? (
                                        <span className="text-red-600">
                                          over limit
                                        </span>
                                      ) : pace.overPace ? (
                                        <span className="text-amber-600">
                                          on pace {money(pace.projectedMonth)} —
                                          safe {money(pace.safeDaily)}/day
                                        </span>
                                      ) : (
                                        <span className="text-emerald-600">
                                          on track — safe{" "}
                                          {money(pace.safeDaily)}/day
                                        </span>
                                      )}
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openEdit(cat)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <ConfirmDialog
                                title={`Delete "${cat.name}"?`}
                                description="Existing expenses keep their data, but this category will be removed. This can't be undone."
                                onConfirm={() => handleDelete(cat)}
                                trigger={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError("");
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
                  setEditError("");
                }}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveEdit}
                disabled={isPending || !editName.trim()}
                className="flex-1"
              >
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}
