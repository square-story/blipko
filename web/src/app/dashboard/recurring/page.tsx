"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Edit } from "lucide-react";
import {
  getRecurringRules,
  deleteRecurringRule,
  type RecurringRuleView,
} from "@/lib/actions/recurring";
import { getCategories, type CategoryStat } from "@/lib/actions/categories";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecurringFormModal } from "./_components/recurring-form-modal";
import { toast } from "@/lib/toast";
import { BUCKET_META } from "@/lib/budget";

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRuleView[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    try {
      const [fetchedRules, fetchedCats] = await Promise.all([
        getRecurringRules(),
        getCategories(),
      ]);
      setRules(fetchedRules);
      setCategories(fetchedCats);
    } catch (err) {
      toast.error("Failed to load recurring data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteRecurringRule(id);
      if (res.success) {
        toast.success("Recurring item deleted");
        await load();
      } else {
        toast.error("Failed to delete item");
      }
    });
  };

  const incomeRules = rules.filter((r) => r.kind === "INCOME");
  const expenseRules = rules.filter((r) => r.kind === "EXPENSE");

  return (
    <ContentLayout title="Recurring">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-4 sm:pt-0 pl-4 sm:pl-0 pr-4 sm:pr-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recurring Items</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your monthly fixed incomes and subscriptions.
          </p>
        </div>
        {!loading && (
          <RecurringFormModal categories={categories} onSaved={load} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 p-4 sm:p-0">
        {/* Income Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>💰</span> Incomes
            </CardTitle>
            <CardDescription>Auto-logged each month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : incomeRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-lg border border-dashed">
                <RefreshCw className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  No recurring incomes yet. Add your salary!
                </p>
              </div>
            ) : (
              <ul className="divide-y border rounded-lg">
                {incomeRules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {r.note || "Income"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Day {r.dayOfMonth}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        +₹{r.amount.toLocaleString("en-IN")}
                      </span>
                      <div className="flex items-center gap-1">
                        <RecurringFormModal
                          rule={r}
                          categories={categories}
                          onSaved={load}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          title="Delete this recurring income?"
                          description="It will stop auto-posting each month. Past logs remain. This can't be undone."
                          onConfirm={() => remove(r.id)}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>💳</span> Expenses
            </CardTitle>
            <CardDescription>Auto-logged each month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : expenseRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-lg border border-dashed">
                <RefreshCw className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  No recurring expenses yet. Add your rent or subscriptions!
                </p>
              </div>
            ) : (
              <ul className="divide-y border rounded-lg">
                {expenseRules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.categoryName || r.note || "Expense"}
                          </span>
                          {r.bucket && BUCKET_META[r.bucket] && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                              {BUCKET_META[r.bucket].emoji} {BUCKET_META[r.bucket].label}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Day {r.dayOfMonth} {r.note && r.categoryName ? `· ${r.note}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-medium text-foreground">
                        ₹{r.amount.toLocaleString("en-IN")}
                      </span>
                      <div className="flex items-center gap-1">
                        <RecurringFormModal
                          rule={r}
                          categories={categories}
                          onSaved={load}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          title="Delete this recurring expense?"
                          description="It will stop auto-posting each month. Past logs remain. This can't be undone."
                          onConfirm={() => remove(r.id)}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ContentLayout>
  );
}
