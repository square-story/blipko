"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TrendingDown, TrendingUp, Calendar, X, Plus } from "lucide-react";
import {
  getRecurringCharges,
  deactivateRecurringCharge,
} from "@/lib/actions/recurring";
import { RecurringChargeDialog } from "./recurring-charge-dialog";

type RecurringCharge = {
  id: string;
  description: string;
  amount: number;
  direction: string;
  period: string;
  dayOfMonth: number;
  walletName: string | null;
  contactName: string | null;
  nextDueDate: string | null;
  nextDueStatus: string | null;
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default function RecurringPage() {
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const res = await getRecurringCharges();
      if (res.success) setCharges(res.data as RecurringCharge[]);
    });

  useEffect(() => {
    load();
  }, []);

  const handleDeactivate = (id: string) =>
    startTransition(async () => {
      await deactivateRecurringCharge(id);
      load();
    });

  const income = charges.filter((c) => c.direction === "INCOME");
  const expenses = charges.filter((c) => c.direction === "EXPENSE");

  return (
    <ContentLayout title="Recurring">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Recurring income and expenses. Tell the bot: &quot;remind me rent ₹8000 on 1st every
            month&quot;.
          </p>
          <RecurringChargeDialog
            onSuccess={load}
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Charge
              </Button>
            }
          />
        </div>

        {income.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-green-600 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Income
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {income.map((c) => (
                <ChargeCard
                  key={c.id}
                  charge={c}
                  onDeactivate={handleDeactivate}
                  isPending={isPending}
                />
              ))}
            </div>
          </section>
        )}

        {expenses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-red-600 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" /> Expenses
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {expenses.map((c) => (
                <ChargeCard
                  key={c.id}
                  charge={c}
                  onDeactivate={handleDeactivate}
                  isPending={isPending}
                />
              ))}
            </div>
          </section>
        )}

        {charges.length === 0 && !isPending && (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p>No recurring charges yet.</p>
            <p className="text-xs mt-1">Add one above or tell the bot to set one up.</p>
          </div>
        )}
      </div>
    </ContentLayout>
  );
}

function ChargeCard({
  charge,
  onDeactivate,
  isPending,
}: {
  charge: RecurringCharge;
  onDeactivate: (id: string) => void;
  isPending: boolean;
}) {
  const isExpense = charge.direction === "EXPENSE";
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{charge.description}</CardTitle>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {charge.description}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop future dues from being generated. Existing dues are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDeactivate(charge.id)}>
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className={`text-xl font-bold ${isExpense ? "text-red-600" : "text-green-600"}`}>
          ₹{charge.amount.toLocaleString("en-IN")}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">
            {ordinal(charge.dayOfMonth)} {charge.period.toLowerCase()}
          </Badge>
          {charge.walletName && <Badge variant="secondary">{charge.walletName}</Badge>}
        </div>
        {charge.nextDueDate && (
          <p className="text-xs text-muted-foreground">
            Next due:{" "}
            {new Date(charge.nextDueDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
            {charge.nextDueStatus === "PARTIAL" && " (partial)"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
