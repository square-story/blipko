"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent } from "@/components/ui/card";

import {
  getCategories,
  getCategorySuggestions,
  deleteCategory,
  setCategoryBudget,
  rebalanceBucket,
  type CategoryStat,
  type CategorySuggestion,
} from "@/lib/actions/categories";
import type { Bucket } from "@prisma/client";
import { getBudgetOverview } from "@/lib/actions/budget";
import { BUCKETS, BUCKET_META, formatMoney } from "@/lib/budget";
import { toast } from "@/lib/toast";
import { AddCategoryForm } from "./_components/add-category-form";
import { BucketSection } from "./_components/bucket-section";
import { EditCategoryModal } from "./_components/edit-category-modal";

type Overview = Awaited<ReturnType<typeof getBudgetOverview>>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryStat | null>(null);

  const load = () =>
    startTransition(async () => {
      const [cats, ov, sugg] = await Promise.all([
        getCategories(),
        getBudgetOverview(),
        getCategorySuggestions(),
      ]);
      setCategories(cats);
      setOverview(ov);
      setSuggestions(sugg);
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

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) if (c.isGroup) m.set(c.id, c.name);
    return m;
  }, [categories]);

  // Only leaf categories are spendable/budgetable; group rows are organization
  // only and never render as categories.
  const leaves = useMemo(
    () => categories.filter((c) => !c.isGroup),
    [categories],
  );

  const suggestionById = useMemo(
    () => new Map(suggestions.map((s) => [s.categoryId, s])),
    [suggestions],
  );

  const handleDelete = (cat: CategoryStat) =>
    startTransition(async () => {
      const res = await deleteCategory(cat.id);
      if (!res.success) {
        toast.error(res.message ?? "Failed to delete");
        return;
      }
      toast.success(`"${cat.name}" deleted`);
      load();
    });

  // Apply one category's suggested budget. Fixed (recurring) suggestions are
  // pinned; history suggestions are a soft accepted estimate.
  const applyBudget = (id: string, amount: number, locked: boolean) =>
    startTransition(async () => {
      const res = await setCategoryBudget(id, amount, locked);
      if (!res.success) {
        toast.error(res.message ?? "Failed to apply");
        return;
      }
      toast.success("Budget applied");
      load();
    });

  // Auto-balance a bucket: distribute its budget across unpinned categories so
  // the allocations sum to the bucket total (pinned categories left untouched).
  const rebalance = (bucket: Bucket) =>
    startTransition(async () => {
      const res = await rebalanceBucket(bucket);
      if (!res.success) {
        toast.error(res.message ?? "Failed to auto-balance");
        return;
      }
      toast.signature(res.message ?? "Bucket balanced");
      load();
    });

  return (
    <ContentLayout title="Categories">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Your spending split into 50/30/20 buckets. Each bucket is your
            budget this cycle; a category limit is an optional cap the bot warns
            you about.
          </p>
          {overview?.periodLabel && (
            <p className="text-xs text-muted-foreground">
              This cycle: {overview.periodLabel}
            </p>
          )}
        </div>

        <AddCategoryForm onAdded={load} />

        {leaves.length === 0 && !isPending && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No categories yet. Add one above to start tracking — the bot
              will also create them as you log spends.
            </CardContent>
          </Card>
        )}

        {leaves.length > 0 && (
          <div className="space-y-12 pt-6">
            {BUCKETS.map((bucket) => {
              const meta = BUCKET_META[bucket];
              const ov = overview?.buckets.find((b) => b.bucket === bucket);
              const inBucket = leaves.filter((c) => c.bucket === bucket);

              return (
                <div key={bucket} className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {meta.emoji} {meta.label}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({inBucket.length})
                    </span>
                  </h2>
                  <div className="bg-card/30 border rounded-2xl p-4 md:p-6 shadow-sm">
                    <BucketSection
                      bucket={bucket}
                      overview={{
                        budget: ov?.budget ?? 0,
                        spent: ov?.spent ?? 0,
                        remaining: ov?.remaining ?? 0,
                        pct: ov?.pct ?? 0,
                      }}
                      categories={inBucket}
                      groupNameById={groupNameById}
                      suggestionById={suggestionById}
                      money={money}
                      day={day}
                      daysInPeriod={daysInPeriod}
                      remainingDays={remainingDays}
                      isPending={isPending}
                      onEdit={setEditing}
                      onDelete={handleDelete}
                      onApplyBudget={applyBudget}
                      onRebalance={rebalance}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditCategoryModal
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </ContentLayout>
  );
}
