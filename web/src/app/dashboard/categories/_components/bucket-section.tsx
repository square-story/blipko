"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/lib/budget";
import { BudgetGauge } from "@/components/analytics/charts/budget-gauge";
import { TONE } from "@/lib/chart-palette";
import { CategoryCard } from "./category-card";
import type {
  CategoryStat,
  CategorySuggestion,
} from "@/lib/actions/categories";
import type { Bucket } from "@prisma/client";

interface BucketOverview {
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
}

interface BucketSectionProps {
  bucket: Bucket;
  overview: BucketOverview;
  categories: CategoryStat[];
  suggestionById: Map<string, CategorySuggestion>;
  money: (n: number) => string;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  isPending: boolean;
  onEdit: (cat: CategoryStat) => void;
  onDelete: (cat: CategoryStat) => void;
  onApplyBudget: (id: string, amount: number, locked: boolean) => void;
  onRebalance: (bucket: Bucket) => void;
}

export const BucketSection = ({
  bucket,
  overview,
  categories,
  suggestionById,
  money,
  day,
  daysInPeriod,
  remainingDays,
  isPending,
  onEdit,
  onDelete,
  onApplyBudget,
  onRebalance,
}: BucketSectionProps) => {
  const meta = BUCKET_META[bucket];
  const { budget, spent, remaining, pct } = overview;
  // Savings is a goal: spending past the target is good, so it's never "over".
  const isSavings = bucket === "SAVINGS";
  const over = !isSavings && remaining < 0;
  const allocated = categories.reduce(
    (s, c) => s + (c.monthlyBudget ?? 0),
    0,
  );
  const unallocated = budget - allocated;
  const overAllocated = unallocated < 0;
  // Spend not attributed to any listed category (uncategorized or hidden
  // system-category spend) — surfaced so the rows reconcile with the bucket total.
  const shownSpend = categories.reduce((s, c) => s + c.spend, 0);
  const uncategorized = Math.max(0, spent - shownSpend);
  // Unpinned categories are the ones Auto-balance redistributes the bucket
  // budget across (pinned ones keep their limit).
  const unpinnedCount = categories.filter((c) => !c.budgetLocked).length;

  return (
    <div>
      {/* Bucket progress summary */}
      <div className="space-y-1 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              over
                ? TONE.negative
                : isSavings && remaining <= 0
                  ? TONE.positive
                  : TONE.neutral,
            )}
          >
            {isSavings
              ? remaining > 0
                ? `${money(remaining)} to save`
                : `${money(Math.abs(remaining))} beyond target`
              : over
                ? `${money(Math.abs(remaining))} over`
                : `${money(remaining)} left`}
          </span>
        </div>
        <BudgetGauge
          pct={pct}
          tone={over ? "negative" : "primary"}
          orientation="linear"
          // The mark is where you'd be if you spent evenly. Hidden without a
          // budget, since there is then nothing to pace against.
          pacePct={
            budget > 0 && daysInPeriod > 0
              ? Math.min(100, (day / daysInPeriod) * 100)
              : undefined
          }
          ariaLabel={`${meta.label} budget used`}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {money(spent)} {isSavings ? "saved" : "spent"} of {money(budget)}
          {budget > 0 &&
            (isSavings ? (
              remaining > 0 && (
                <> · save {money(remaining / remainingDays)}/day to target</>
              )
            ) : (
              !over && (
                <> · safe {money(Math.max(0, remaining) / remainingDays)}/day</>
              )
            ))}
        </p>
      </div>

      {/* Allocation (informational) + apply data-driven suggestions */}
      {categories.length > 0 && budget > 0 && (
        <div className="flex items-center justify-between gap-2 border-t pt-2 pb-3">
          <p className="text-xs tabular-nums text-muted-foreground">
            {money(allocated)} allocated ·{" "}
            <span className={cn(overAllocated && TONE.negative)}>
              {overAllocated
                ? `${money(-unallocated)} over-allocated`
                : `${money(unallocated)} unallocated`}
            </span>
          </p>
          {unpinnedCount > 0 && (
            <ConfirmDialog
              title={`Auto-balance ${meta.label}?`}
              description={`Split this bucket's ${money(budget)} budget across its ${unpinnedCount} unpinned categor${unpinnedCount === 1 ? "y" : "ies"}, weighted by your recurring expenses and recent history, so the limits add up to the bucket total. Pinned categories are left untouched.`}
              confirmLabel="Auto-balance"
              destructive={false}
              onConfirm={() => onRebalance(bucket)}
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
          )}
        </div>
      )}

      {/* Flat list of the bucket's leaf categories. Groups never reach here —
          page.tsx filters them out, and they can't hold a budget anyway. */}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories in this bucket yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              suggestion={suggestionById.get(cat.id) ?? null}
              money={money}
              day={day}
              daysInPeriod={daysInPeriod}
              remainingDays={remainingDays}
              isPending={isPending}
              onEdit={onEdit}
              onDelete={onDelete}
              onApplyBudget={onApplyBudget}
            />
          ))}
        </div>
      )}

      {uncategorized > 0 && (
        <p className="pt-2 text-xs text-muted-foreground tabular-nums">
          Uncategorized · {money(uncategorized)} {isSavings ? "saved" : "spent"}
        </p>
      )}
    </div>
  );
};
