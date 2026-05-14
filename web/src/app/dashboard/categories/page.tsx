"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tag, Pencil } from "lucide-react";
import {
  getCategories,
  renameCategory,
  type CategoryStat,
} from "@/lib/actions/categories";

const fmt = (n: number) =>
  n === 0
    ? "—"
    : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [editing, setEditing] = useState<CategoryStat | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const data = await getCategories();
      setCategories(data);
    });

  useEffect(() => {
    load();
  }, []);

  const openEdit = (cat: CategoryStat) => {
    setEditing(cat);
    setNewName(cat.name);
    setError("");
  };

  const handleRename = () =>
    startTransition(async () => {
      if (!editing) return;
      const res = await renameCategory(editing.name, newName);
      if (!res.success) {
        setError(res.message ?? "Failed to rename");
        return;
      }
      setEditing(null);
      load();
    });

  return (
    <ContentLayout title="Categories">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Categories are inferred from your transactions. Click{" "}
          <Pencil className="inline h-3 w-3" /> to rename — all matching
          transactions update automatically.
        </p>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Total Received</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.name}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/transactions?category=${encodeURIComponent(cat.name)}`}
                      className="hover:underline"
                    >
                      {cat.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {cat.transactionCount}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    {fmt(cat.totalSpend)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {fmt(cat.totalIncome)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && !isPending && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <Tag className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p>No categories yet. Add transactions to see them here.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>New name</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRename}
                disabled={isPending || !newName.trim()}
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
