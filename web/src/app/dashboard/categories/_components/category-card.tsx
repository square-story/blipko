"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BudgetGauge } from "@/components/analytics/charts/budget-gauge";
import { categoryPacing } from "@/lib/budget";
import { TONE, type Tone } from "@/lib/chart-palette";
import { cn } from "@/lib/utils";
import {
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { resolveCategoryEmoji } from "@/lib/category-emoji";
import type { CategoryStat, CategorySuggestion } from "@/lib/actions/categories";

interface CategoryCardProps {
  cat: CategoryStat;
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

export function CategoryCard({
  cat,
  suggestion,
  money,
  day,
  daysInPeriod,
  remainingDays,
  isPending,
  onEdit,
  onDelete,
  onApplyBudget,
}: CategoryCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const reduce = useReducedMotion();
  const displayIcon = cat.icon ?? resolveCategoryEmoji(cat.name);

  const hasLimit = cat.monthlyBudget != null;
  const limit = cat.monthlyBudget ?? 0;
  
  const suggest =
    !cat.budgetLocked &&
    suggestion?.amount != null &&
    suggestion.amount !== cat.monthlyBudget
      ? suggestion
      : null;

  const left = hasLimit ? limit - cat.spend : null;
  
  const pace = categoryPacing({
    spent: cat.spend,
    limit: cat.monthlyBudget,
    day,
    daysInPeriod,
    remainingDays,
  });

  const isSavings = cat.bucket === "SAVINGS";
  const savedAll = hasLimit && cat.spend >= limit;
  const overPace = pace.overPace && pace.reliable;
  const overSpent = pace.overSpent;

  // The ring and the figure always carried the same colour; one tone now
  // drives both.
  let tone: Tone | "primary" = "primary";

  if (hasLimit) {
    if (isSavings) {
      if (savedAll) tone = "positive";
    } else if (overSpent) {
      tone = "negative";
    } else if (overPace) {
      tone = "caution";
    } else {
      tone = "positive";
    }
  } else {
    tone = "neutral";
  }

  const colorClass = tone === "primary" ? "text-primary" : TONE[tone];

  let pct = 0;
  if (hasLimit && limit > 0) {
    pct = (cat.spend / limit) * 100;
  } else if (!hasLimit && cat.spend > 0) {
    pct = 0;
  }

  return (
    <>
      <div className="relative flex items-center justify-between p-5 rounded-2xl bg-card border shadow-sm overflow-hidden group hover:border-border/80 transition-colors">
        <Link
          href={`/dashboard/categories/${cat.id}`}
          className="flex items-center gap-4 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 shrink-0">
            <motion.span
              key={displayIcon}
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={reduce ? {} : { scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="text-lg leading-none"
            >
              {displayIcon}
            </motion.span>
          </div>
          
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground truncate group-hover:text-foreground transition-colors">{cat.name}</span>
              {cat.budgetLocked && (
                <Lock className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>
            {/* truncate matters: without it this sets a min-content width the
                flex row cannot shrink below, and a long amount runs into the
                gauge at the 4-up breakpoint. */}
            <div className="text-lg font-bold text-foreground truncate">
              {hasLimit ? money(limit) : money(cat.spend)}
            </div>
            
            {hasLimit ? (
               <div className={cn("text-xs font-medium", colorClass)}>
                 {isSavings ? (
                   left! <= 0 ? `${money(Math.abs(left!))} beyond target` : `${money(left!)} to go`
                 ) : (
                   left! < 0 ? `${money(Math.abs(left!))} over` : `${money(left!)} left`
                 )}
               </div>
            ) : (
               <div className="text-xs font-medium text-muted-foreground">
                 {isSavings ? "saved (no limit)" : "spent (no limit)"}
               </div>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          {/* No gauge without a budget — there is nothing to be a percentage
              of, and the emoji chip on the left already identifies the card, so
              a medallion here would just repeat it. The "(no limit)" caption
              carries the meaning. */}
          {hasLimit && (
            <BudgetGauge
              pct={pct}
              tone={tone}
              pacePct={
                daysInPeriod > 0
                  ? Math.min(100, (day / daysInPeriod) * 100)
                  : undefined
              }
              size={48}
              ariaLabel={`${cat.name} budget used`}
            />
          )}

          <div className="opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(cat)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                {suggest && (
                  <DropdownMenuItem onClick={() => onApplyBudget(cat.id, suggest.amount!, suggest.basis === "recurring")}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Apply {money(suggest.amount!)}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      <ConfirmDialog 
         open={deleteOpen}
         onOpenChange={setDeleteOpen}
         title={`Delete "${cat.name}"?`}
         description="Existing expenses keep their data, but this category will be removed. This can't be undone."
         onConfirm={() => onDelete(cat)}
      />
    </>
  );
}
