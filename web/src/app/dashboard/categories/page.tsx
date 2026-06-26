"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getCategories,
  deleteCategory,
  type CategoryStat,
} from "@/lib/actions/categories";
import { getBudgetOverview } from "@/lib/actions/budget";
import {
  BUCKETS,
  BUCKET_META,
  formatMoney,
  weightedBudgets,
} from "@/lib/budget";
import { setCategoryBudgets } from "@/lib/actions/categories";
import { toast } from "@/lib/toast";
import { AddCategoryForm } from "./_components/add-category-form";
import { BucketSection } from "./_components/bucket-section";
import { EditCategoryModal } from "./_components/edit-category-modal";

type Overview = Awaited<ReturnType<typeof getBudgetOverview>>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryStat | null>(null);

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

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) if (c.isGroup) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const leaves = useMemo(
    () => categories.filter((c) => !c.isGroup),
    [categories],
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

  const autoBalance = (cats: CategoryStat[], budget: number) =>
    startTransition(async () => {
      const updates = weightedBudgets(cats, budget);
      if (updates.length === 0) return;
      const res = await setCategoryBudgets(updates);
      if (!res.success) {
        toast.error(res.message ?? "Failed to auto-balance");
        return;
      }
      toast.success("Budgets auto-balanced");
      load();
    });

  return (
    <ContentLayout title="Categories">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Your spending split into 50/30/20 buckets. Each bucket is your
            budget for the month; a category limit is an optional cap the bot
            warns you about.
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
          <Accordion
            type="single"
            collapsible
            defaultValue="NEEDS"
            className="space-y-2"
          >
            {BUCKETS.map((bucket) => {
              const meta = BUCKET_META[bucket];
              const ov = overview?.buckets.find((b) => b.bucket === bucket);
              const inBucket = leaves.filter((c) => c.bucket === bucket);

              return (
                <AccordionItem key={bucket} value={bucket} className="rounded-lg border px-4 last:border-b">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline hover:opacity-80 transition-opacity">
                    <span className="flex items-center gap-2">
                      {meta.emoji} {meta.label}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({inBucket.length})
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
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
                      money={money}
                      day={day}
                      daysInPeriod={daysInPeriod}
                      remainingDays={remainingDays}
                      isPending={isPending}
                      onEdit={setEditing}
                      onDelete={handleDelete}
                      onAutoBalance={autoBalance}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
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
