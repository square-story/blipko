"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUCKET_META, formatMoney } from "@/lib/budget";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignExpenseCategory } from "@/lib/actions/expenses";
import { toast } from "sonner";
import { Check, CheckCircle2, AlertCircle } from "lucide-react";
import type { CategoryStat } from "@/lib/actions/categories";

interface NeedsReviewInboxProps {
  expenses: {
    id: string;
    amount: number;
    bucket: string;
    categoryName: string | null;
    note: string | null;
    source: string;
    date: Date;
    confidence: number;
  }[];
  categories: CategoryStat[];
  currency: string;
}

export function NeedsReviewInbox({ expenses, categories, currency }: NeedsReviewInboxProps) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(expenses);

  if (items.length === 0) return null;

  const handleAssign = (expenseId: string, categoryId: string) => {
    startTransition(async () => {
      const res = await assignExpenseCategory(expenseId, categoryId);
      if (res.success) {
        toast.success("Transaction reassigned");
        setItems(prev => prev.filter(e => e.id !== expenseId));
      } else {
        toast.error(res.message || "Failed to reassign");
      }
    });
  };

  const leaves = categories.filter(c => !c.isGroup || c.spend > 0 || c.monthlyBudget !== null);

  return (
    <Card className="border-amber-500/50 bg-amber-500/5 shadow-md mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
          <AlertCircle className="h-5 w-5" />
          Needs Review ({items.length})
        </CardTitle>
        <CardDescription>
          The bot wasn&apos;t totally sure about these transactions, or they fell into a generic bucket. Please assign them to a specific category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((e) => (
            <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-background rounded-lg border">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatMoney(e.amount, currency)}</span>
                  <Badge variant="outline" className="text-xs">
                    {e.categoryName || "Uncategorized"}
                  </Badge>
                  {e.confidence < 0.8 && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Low Confidence
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {e.note || "No details provided"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.date.toLocaleDateString()} via {e.source.toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  disabled={isPending}
                  onValueChange={(val) => handleAssign(e.id, val)}
                >
                  <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Reassign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leaves.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-xs">
                        {BUCKET_META[cat.bucket].emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
