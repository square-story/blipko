"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { categoryPacing } from "@/lib/budget";
import type { CategoryStat } from "@/lib/actions/categories";

interface CategoryRowProps {
  cat: CategoryStat;
  groupName: string | null;
  money: (n: number) => string;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  isPending: boolean;
  onEdit: (cat: CategoryStat) => void;
  onDelete: (cat: CategoryStat) => void;
}

export const CategoryRow = ({
  cat,
  groupName,
  money,
  day,
  daysInPeriod,
  remainingDays,
  isPending,
  onEdit,
  onDelete,
}: CategoryRowProps) => {
  const hasLimit = cat.monthlyBudget != null;
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

  const pacingLabel = hasLimit
    ? isSavings
      ? savedAll
        ? "saved"
        : "saving"
      : pace.overSpent
        ? "over limit"
        : pace.overPace
          ? "over pace"
          : "on track"
    : null;

  const pacingVariant = hasLimit
    ? isSavings
      ? "outline"
      : pace.overSpent
        ? "destructive"
        : pace.overPace
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
        : pace.overPace
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
                </p>
                {hasLimit && (
                  <p>
                    {isSavings
                      ? savedAll
                        ? `Target reached — ${money(cat.spend)} saved`
                        : `Save ${money(pace.safeDaily)}/day to reach ${money(cat.monthlyBudget!)}`
                      : pace.overSpent
                        ? "Already over limit"
                        : pace.overPace
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
              of {money(cat.monthlyBudget!)} ·{" "}
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
