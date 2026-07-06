"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CircularProgress } from "@/components/ui/circular-progress";
import { categoryPacing } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { 
  Utensils, Home, CarFront, ShoppingBag, Clapperboard, Pill, Plane, BookOpen, 
  MoreVertical, Pencil, Trash2, CheckCircle2, CircleDashed, Coffee, Lightbulb, 
  Wifi, Smartphone, Shirt, Dumbbell, Baby, Dog, Gamepad2, Gift, HeartHandshake, Lock
} from "lucide-react";
import type { CategoryStat, CategorySuggestion } from "@/lib/actions/categories";

function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("food") || n.includes("dining") || n.includes("restaurant") || n.includes("eat")) return Utensils;
  if (n.includes("coffee") || n.includes("cafe")) return Coffee;
  if (n.includes("house") || n.includes("housing") || n.includes("rent") || n.includes("mortgage")) return Home;
  if (n.includes("transport") || n.includes("car") || n.includes("auto") || n.includes("gas") || n.includes("fuel") || n.includes("travel") || n.includes("flight") || n.includes("vacation") || n.includes("trip") || n.includes("hotel")) {
      if (n.includes("flight") || n.includes("plane")) return Plane;
      return CarFront;
  }
  if (n.includes("shop") || n.includes("store") || n.includes("grocer") || n.includes("supermarket")) return ShoppingBag;
  if (n.includes("clothes") || n.includes("apparel") || n.includes("clothing")) return Shirt;
  if (n.includes("entertain") || n.includes("movie") || n.includes("film") || n.includes("cinema") || n.includes("subscrip")) return Clapperboard;
  if (n.includes("health") || n.includes("medical") || n.includes("doctor") || n.includes("pharm") || n.includes("medicine")) return Pill;
  if (n.includes("fitness") || n.includes("gym") || n.includes("workout")) return Dumbbell;
  if (n.includes("education") || n.includes("school") || n.includes("tuition") || n.includes("book") || n.includes("course")) return BookOpen;
  if (n.includes("utilit") || n.includes("electric") || n.includes("water") || n.includes("bill")) return Lightbulb;
  if (n.includes("internet") || n.includes("wifi") || n.includes("broadband")) return Wifi;
  if (n.includes("phone") || n.includes("mobile") || n.includes("cell")) return Smartphone;
  if (n.includes("baby") || n.includes("kids") || n.includes("child")) return Baby;
  if (n.includes("pet") || n.includes("dog") || n.includes("cat") || n.includes("vet")) return Dog;
  if (n.includes("game") || n.includes("gaming") || n.includes("hobby")) return Gamepad2;
  if (n.includes("gift") || n.includes("present") || n.includes("donation")) return Gift;
  if (n.includes("charity") || n.includes("give")) return HeartHandshake;
  return CircleDashed;
}

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

  let colorClass = "text-primary";
  let ringColor = "text-primary";
  
  if (hasLimit) {
    if (isSavings) {
      if (savedAll) {
        colorClass = "text-emerald-500 dark:text-emerald-400";
        ringColor = "text-emerald-500 dark:text-emerald-400";
      }
    } else {
      if (overSpent) {
        colorClass = "text-red-500 dark:text-red-400";
        ringColor = "text-red-500 dark:text-red-400";
      } else if (overPace) {
        colorClass = "text-amber-500 dark:text-amber-400";
        ringColor = "text-amber-500 dark:text-amber-400";
      } else {
        colorClass = "text-emerald-500 dark:text-emerald-400";
        ringColor = "text-emerald-500 dark:text-emerald-400";
      }
    }
  } else {
    colorClass = "text-muted-foreground";
    ringColor = "text-muted-foreground";
  }

  let pct = 0;
  if (hasLimit && limit > 0) {
    pct = (cat.spend / limit) * 100;
  } else if (!hasLimit && cat.spend > 0) {
    pct = 0;
  }

  return (
    <>
      <div className="relative flex items-center justify-between p-5 rounded-2xl bg-card border shadow-sm overflow-hidden group hover:border-border/80 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 text-muted-foreground shrink-0">
            {React.createElement(getCategoryIcon(cat.name), { className: "w-5 h-5" })}
          </div>
          
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground truncate">{cat.name}</span>
              {cat.budgetLocked && (
                <Lock className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>
            <div className="text-xl font-bold text-foreground">
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
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <CircularProgress 
            value={pct} 
            size={52} 
            strokeWidth={4} 
            color={ringColor} 
          />
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
