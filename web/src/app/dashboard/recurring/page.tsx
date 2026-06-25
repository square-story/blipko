"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, RefreshCw } from "lucide-react";
import {
  getRecurringRules,
  createRecurringRule,
  deleteRecurringRule,
  type RecurringRuleView,
} from "@/lib/actions/recurring";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRuleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // form state
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [bucket, setBucket] = useState<"NEEDS" | "WANTS" | "SAVINGS">("NEEDS");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const load = () => getRecurringRules().then(setRules).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const add = () => {
    setError(null);
    const amt = Number(amount);
    const d = Number(day);
    if (!(amt > 0)) return setError("Enter a valid amount.");
    if (!(d >= 1 && d <= 28)) return setError("Day must be 1–28.");
    startTransition(async () => {
      const res = await createRecurringRule({
        kind,
        amount: amt,
        dayOfMonth: d,
        bucket: kind === "EXPENSE" ? bucket : undefined,
        category: kind === "EXPENSE" ? category.trim() || undefined : undefined,
        note: note.trim() || undefined,
      });
      if (!res.success) return setError(res.error ?? "Failed to add.");
      setAmount("");
      setCategory("");
      setNote("");
      await load();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteRecurringRule(id);
      await load();
    });
  };

  return (
    <ContentLayout title="Recurring">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add a recurring item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as "INCOME" | "EXPENSE")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="8000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="day">Day of month (1–28)</Label>
                <Input
                  id="day"
                  type="number"
                  min={1}
                  max={28}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
              {kind === "EXPENSE" && (
                <div className="space-y-2">
                  <Label>Bucket</Label>
                  <Select value={bucket} onValueChange={(v) => setBucket(v as typeof bucket)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEEDS">Needs</SelectItem>
                      <SelectItem value="WANTS">Wants</SelectItem>
                      <SelectItem value="SAVINGS">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {kind === "EXPENSE" && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category (optional)</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Rent"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="rent"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={add} disabled={pending}>
              <Plus className="mr-2 size-4" /> Add recurring
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your recurring items</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. Add one above, or tell the bot &quot;rent 8000 on 1st every month&quot;.
              </p>
            ) : (
              <ul className="divide-y">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {r.kind === "INCOME" ? "Income" : r.categoryName ?? r.note ?? "Expense"}
                          {" · "}₹{r.amount.toLocaleString("en-IN")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Day {r.dayOfMonth}
                          {r.bucket ? ` · ${r.bucket[0]}${r.bucket.slice(1).toLowerCase()}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline">{r.kind.toLowerCase()}</Badge>
                    </div>
                    <ConfirmDialog
                      title="Delete this recurring item?"
                      description="It will stop auto-posting each month. This can't be undone."
                      onConfirm={() => remove(r.id)}
                      trigger={
                        <Button variant="ghost" size="icon" disabled={pending}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
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
