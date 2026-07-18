"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/budget";
import { Plus, Minus } from "lucide-react";
import type { BoxView } from "@/lib/actions/boxes";
import { BoxEntryModal } from "../../_components/box-entry-modal";

const money = (n: number) => formatMoney(n);

export function BoxDetailHeader({ box }: { box: BoxView }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const hasTarget = box.targetAmount != null && box.targetAmount > 0;
  const target = box.targetAmount ?? 0;
  // Progress toward the goal includes tracked budget spend; the money balance
  // shown as the headline number does not.
  const progress = box.balance + box.tracked;
  const reached = hasTarget && progress >= target;
  const pct = hasTarget ? (progress / target) * 100 : 0;
  const remaining = target - progress;
  const ringColor = reached
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-primary";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-card border shadow-sm p-5">
      <div className="flex items-center gap-4 min-w-0">
        {hasTarget ? (
          <CircularProgress value={pct} size={64} strokeWidth={5} color={ringColor} />
        ) : (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 text-2xl shrink-0">
            {box.icon || "📦"}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight truncate">
              {box.icon && hasTarget ? `${box.icon} ` : ""}
              {box.name}
            </h2>
            {box.categoryName && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                🔗 {box.categoryName}
              </Badge>
            )}
          </div>
          <div className="text-2xl font-bold text-foreground mt-0.5">
            {money(box.balance)}
          </div>
          <div
            className={cn(
              "text-xs font-medium",
              reached
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {hasTarget
              ? reached
                ? `🎉 Target reached · ${money(target)}`
                : `${money(remaining)} to go · target ${money(target)}`
              : "Open fund"}
          </div>
          {box.tracked > 0 && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              incl. {money(box.tracked)} tracked from budget
            </div>
          )}
        </div>
      </div>

      {!box.isArchived && (
        <div className="flex items-center gap-2 shrink-0">
          <BoxEntryModal
            box={box}
            mode="IN"
            onSaved={refresh}
            trigger={
              <Button size="sm" variant="outline" className="text-green-600">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            }
          />
          <BoxEntryModal
            box={box}
            mode="OUT"
            onSaved={refresh}
            trigger={
              <Button size="sm" variant="outline">
                <Minus className="mr-1 h-3.5 w-3.5" /> Spend
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
