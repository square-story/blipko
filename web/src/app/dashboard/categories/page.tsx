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
import { Badge } from "@/components/ui/badge";
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
  deleteCategory,
  type CategoryStat,
} from "@/lib/actions/categories";
import { BUCKETS, BUCKET_META, formatMoney } from "@/lib/budget";
import { ConfirmDialog } from "@/components/confirm-dialog";

const fmt = (n: number) => (n === 0 ? "—" : formatMoney(n));

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
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
      setCategories(await getCategories());
    });

  useEffect(() => {
    load();
  }, []);

  // Group rows are organizational only — used to label children, not listed.
  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) if (c.isGroup) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const handleAdd = () =>
    startTransition(async () => {
      const res = await createCategory(newName, newBucket);
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
        if (!r.success) {
          setEditError(r.message ?? "Failed to rename");
          return;
        }
      }
      if (editBucket !== editing.bucket) {
        const r = await setCategoryBucket(editing.id, editBucket);
        if (!r.success) {
          setEditError(r.message ?? "Failed to change bucket");
          return;
        }
      }
      const trimmed = editBudget.trim();
      const nextBudget = trimmed === "" ? null : Number(trimmed);
      if (nextBudget !== editing.monthlyBudget) {
        const r = await setCategoryBudget(editing.id, nextBudget);
        if (!r.success) {
          setEditError(r.message ?? "Failed to set budget");
          return;
        }
      }
      setEditing(null);
      load();
    });

  const handleDelete = (cat: CategoryStat) =>
    startTransition(async () => {
      await deleteCategory(cat.id);
      load();
    });

  return (
    <ContentLayout title="Categories">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Your categories, grouped into 50/30/20 buckets. Set a monthly limit on
          any of them — the bot warns you as you approach it.
        </p>

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
              <Button onClick={handleAdd} disabled={isPending || !newName.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {addError && (
              <p className="mt-2 text-sm text-destructive">{addError}</p>
            )}
          </CardContent>
        </Card>

        {/* Grouped by bucket (leaf categories only) */}
        {BUCKETS.map((bucket) => {
          const inBucket = categories.filter(
            (c) => c.bucket === bucket && !c.isGroup,
          );
          return (
            <Card key={bucket}>
              <CardHeader>
                <CardTitle className="text-base">
                  {BUCKET_META[bucket].emoji} {BUCKET_META[bucket].label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inBucket.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories.</p>
                ) : (
                  <div className="divide-y">
                    {inBucket.map((cat) => {
                      const group = cat.parentId
                        ? groupNameById.get(cat.parentId)
                        : null;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cat.name}</span>
                            {group && (
                              <span className="text-xs text-muted-foreground">
                                {group}
                              </span>
                            )}
                            {cat.isSystem && (
                              <Badge variant="secondary" className="text-xs">
                                System
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {fmt(cat.spend)}
                              {cat.monthlyBudget != null && (
                                <span className="text-muted-foreground/70">
                                  {" "}
                                  / {formatMoney(cat.monthlyBudget)}
                                </span>
                              )}
                            </span>
                            {!cat.isSystem && (
                              <>
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
                              </>
                            )}
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
