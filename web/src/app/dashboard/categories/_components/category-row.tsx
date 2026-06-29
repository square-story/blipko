"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { categoryPacing } from "@/lib/budget";
import type {
  CategoryStat,
  CategorySuggestion,
} from "@/lib/actions/categories";

interface CategoryRowProps {
  cat: CategoryStat;
  groupName: string | null;
  suggestion: CategorySuggestion | null;
  money: (n: number) => string;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  isPending: boolean;
  onEdit: (cat: CategoryStat) => void;
  onDelete: (cat: CategoryStat) => void;
  onApplyBudget: (id: string, amount: number, locked: boolean) => void;
}

const BASIS_LABEL: Record<CategorySuggestion["basis"], string> = {
  recurring: "fixed",
  history: "3-mo median",
  new: "",
};

export const CategoryRow = ({
  cat,
  groupName,
  suggestion,
  money,
  day,
  daysInPeriod,
  remainingDays,
  isPending,
  onEdit,
  onDelete,
  onApplyBudget,
}: CategoryRowProps) => {
  const hasLimit = cat.monthlyBudget != null;
  // Show a suggestion only when it differs from the current limit and isn't pinned.
  const suggest =
    !cat.budgetLocked &&
    suggestion?.amount != null &&
    suggestion.amount !== cat.monthlyBudget
      ? suggestion
      : null;
  const left = hasLimit ? cat.monthlyBudget! - cat.spend : null;
  const pace = categoryPacing({
    spent: cat.spend,
    limit: cat.monthlyBudget,
    day,
    daysInPeriod,
    remainingDays,
  });

  // Savings is a goal, not a cap: reaching/exceeding the target is good, so it
  // never shows the over-limit/over-pace warnings used for Needs/Wants.
  const isSavings = cat.bucket === "SAVINGS";
  const savedAll = hasLimit && cat.spend >= cat.monthlyBudget!;
  // Only trust the "over pace" projection once a few days into the cycle.
  const overPace = pace.overPace && pace.reliable;

  const pacingLabel = hasLimit
    ? isSavings
      ? savedAll
        ? "saved"
        : "saving"
      : pace.overSpent
        ? "over limit"
        : overPace
          ? "over pace"
          : "on track"
    : null;

  const pacingVariant = hasLimit
    ? isSavings
      ? "outline"
      : pace.overSpent
        ? "destructive"
        : overPace
          ? "secondary"
          : "outline"
    : null;

  const pacingColor = hasLimit
    ? isSavings
      ? savedAll
        ? "text-emerald-600"
        : "text-muted-foreground"
      : pace.overSpent
        ? "text-red-600"
        : overPace
          ? "text-amber-600"
          : "text-emerald-600"
    : null;

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{cat.name}</span>
          {groupName && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {groupName}
            </span>
          )}
          {pacingLabel && cat.spend > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={pacingVariant!}
                  className={cn("cursor-default text-[10px]", pacingColor)}
                >
                  {pacingLabel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left">
                <p>
                  ~{money(pace.dailyRate)}/day · ~{money(pace.weekly)}/wk
                  projected
                </p>
                {hasLimit && (
                  <p>
                    {isSavings
                      ? savedAll
                        ? `Target reached — ${money(cat.spend)} saved`
                        : `Save ${money(pace.safeDaily)}/day to reach ${money(cat.monthlyBudget!)}`
                      : pace.overSpent
                        ? "Already over limit"
                        : overPace
                          ? `Projected ${money(pace.projectedMonth)} — safe ${money(pace.safeDaily)}/day`
                          : `On track — safe ${money(pace.safeDaily)}/day`}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(cat.spend)} {isSavings ? "saved" : "spent"}
          {hasLimit && (
            <>
              {" "}
              of {money(cat.monthlyBudget!)}
              {cat.budgetLocked && (
                <Lock
                  className="ml-1 inline size-3 align-[-1px]"
                  aria-label="Fixed — Auto-balance won't change this"
                />
              )}{" "}
              ·{" "}
              {isSavings ? (
                <span className={cn(left! <= 0 && "text-emerald-600")}>
                  {left! <= 0
                    ? `${money(Math.abs(left!))} beyond target`
                    : `${money(left!)} to go`}
                </span>
              ) : (
                <span className={cn(left! < 0 && "text-red-600")}>
                  {left! < 0
                    ? `${money(Math.abs(left!))} over`
                    : `${money(left!)} left`}
                </span>
              )}
            </>
          )}
        </p>
        {suggest && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Suggested {money(suggest.amount!)}
            {BASIS_LABEL[suggest.basis] && ` · ${BASIS_LABEL[suggest.basis]}`} ·{" "}
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                onApplyBudget(
                  cat.id,
                  suggest.amount!,
                  suggest.basis === "recurring",
                )
              }
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              Apply
            </button>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onEdit(cat)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <ConfirmDialog
          title={`Delete "${cat.name}"?`}
          description="Existing expenses keep their data, but this category will be removed. This can't be undone."
          onConfirm={() => onDelete(cat)}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          }
        />
      </div>
    </div>
  );
};
