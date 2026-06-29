"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/lib/budget";
import { CategoryRow } from "./category-row";
import type { CategoryStat } from "@/lib/actions/categories";
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
  groupNameById: Map<string, string>;
  money: (n: number) => string;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  isPending: boolean;
  onEdit: (cat: CategoryStat) => void;
  onDelete: (cat: CategoryStat) => void;
  onAutoBalance: (cats: CategoryStat[], budget: number) => void;
}

export const BucketSection = ({
  bucket,
  overview,
  categories,
  groupNameById,
  money,
  day,
  daysInPeriod,
  remainingDays,
  isPending,
  onEdit,
  onDelete,
  onAutoBalance,
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

  return (
    <div>
      {/* Bucket progress summary */}
      <div className="space-y-1 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              over
                ? "text-red-600"
                : isSavings && remaining <= 0
                  ? "text-emerald-600"
                  : "text-muted-foreground",
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
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              over ? "bg-red-500" : "bg-primary",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
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

      {/* Allocation bar + auto-balance */}
      {categories.length > 0 && budget > 0 && (
        <div className="flex items-center justify-between gap-2 border-t pt-2 pb-3">
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
            destructive={false}
            onConfirm={() => onAutoBalance(categories, budget)}
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

      {/* Flat list of the bucket's categories; the group is a subtle tag per row,
          not a sub-header (groups can span buckets, which made headers confusing). */}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories in this bucket yet.
        </p>
      ) : (
        <div className="divide-y">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              groupName={
                cat.parentId
                  ? (groupNameById.get(cat.parentId) ?? null)
                  : null
              }
              money={money}
              day={day}
              daysInPeriod={daysInPeriod}
              remainingDays={remainingDays}
              isPending={isPending}
              onEdit={onEdit}
              onDelete={onDelete}
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
