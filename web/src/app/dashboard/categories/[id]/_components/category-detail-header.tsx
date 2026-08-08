"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BudgetGauge } from "@/components/analytics/charts/budget-gauge";
import { categoryPacing, BUCKET_META, formatMoney } from "@/lib/budget";
import { TONE, type Tone } from "@/lib/chart-palette";
import { cn } from "@/lib/utils";
import { Pencil, Lock } from "lucide-react";
import { resolveCategoryEmoji } from "@/lib/category-emoji";
import type { CategoryDetail } from "@/lib/actions/categories";
import { EditCategoryModal } from "../../_components/edit-category-modal";

export function CategoryDetailHeader({ detail }: { detail: CategoryDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const money = (n: number) => formatMoney(n, detail.currency, detail.locale);
  const displayIcon = detail.icon ?? resolveCategoryEmoji(detail.name);

  const hasLimit = detail.monthlyBudget != null;
  const limit = detail.monthlyBudget ?? 0;
  const left = limit - detail.spend;

  const pace = categoryPacing({
    spent: detail.spend,
    limit: detail.monthlyBudget,
    day: detail.day,
    daysInPeriod: detail.daysInPeriod,
    remainingDays: detail.remainingDays,
  });

  // Same colour rules as the cards on /dashboard/categories: SAVINGS inverts
  // (spending toward the target is good), spend buckets go red/amber/emerald.
  const isSavings = detail.bucket === "SAVINGS";
  const savedAll = hasLimit && detail.spend >= limit;
  const overPace = pace.overPace && pace.reliable;

  let tone: Tone | "primary" = "neutral";
  if (hasLimit) {
    if (isSavings) {
      tone = savedAll ? "positive" : "primary";
    } else if (pace.overSpent) {
      tone = "negative";
    } else if (overPace) {
      tone = "caution";
    } else {
      tone = "positive";
    }
  }

  const toneClass = tone === "primary" ? "text-primary" : TONE[tone];

  const pct = hasLimit && limit > 0 ? (detail.spend / limit) * 100 : 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-card border shadow-sm p-5">
        <div className="flex items-center gap-4 min-w-0">
          {hasLimit ? (
            <BudgetGauge
              pct={pct}
              tone={tone}
              pacePct={
                detail.daysInPeriod > 0
                  ? Math.min(100, (detail.day / detail.daysInPeriod) * 100)
                  : undefined
              }
              centerValue={detail.spend}
              label="spent"

              currency={detail.currency}
              size={120}
              ariaLabel={`${detail.name} budget used`}
            />
          ) : (
            // Matches the gauge's footprint so the header does not reflow
            // depending on whether a budget is set.
            <div className="flex items-center justify-center w-[120px] h-[120px] rounded-full bg-muted/50 text-3xl shrink-0">
              {displayIcon}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight truncate">
                {hasLimit ? `${displayIcon} ` : ""}
                {detail.name}
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-normal"
              >
                {BUCKET_META[detail.bucket].emoji}{" "}
                {BUCKET_META[detail.bucket].label}
              </Badge>
              {detail.budgetLocked && (
                <Lock className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>

            <div className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">
              {money(detail.spend)}
              {hasLimit && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  of {money(limit)}
                </span>
              )}
            </div>

            <div className={cn("text-xs font-medium", toneClass)}>
              {hasLimit
                ? isSavings
                  ? left <= 0
                    ? `${money(Math.abs(left))} beyond target`
                    : `${money(left)} to go · ${money(pace.safeDaily)}/day to hit it`
                  : left < 0
                    ? `${money(Math.abs(left))} over`
                    : `${money(left)} left · safe ${money(pace.safeDaily)}/day`
                : isSavings
                  ? "saved (no limit)"
                  : "spent (no limit)"}
            </div>

            <div className="text-[11px] text-muted-foreground mt-0.5">
              {detail.periodLabel} · day {detail.day} of {detail.daysInPeriod}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>

      <EditCategoryModal
        category={editing ? detail : null}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    </>
  );
}
