"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";
import { getUpcomingDues, markDueAsPaid } from "@/lib/actions/recurring";

type DueEntry = {
  id: string;
  description: string;
  direction: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  walletName: string | null;
};

export default function DuesPage() {
  const [dues, setDues] = useState<DueEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const res = await getUpcomingDues(30);
      if (res.success) setDues(res.data as DueEntry[]);
    });

  useEffect(() => { load(); }, []);

  const handlePay = (id: string) =>
    startTransition(async () => {
      await markDueAsPaid(id);
      load();
    });

  const overdue = dues.filter((d) => new Date(d.dueDate) < new Date());
  const upcoming = dues.filter((d) => new Date(d.dueDate) >= new Date());

  return (
    <ContentLayout title="Upcoming Dues">
      <div className="space-y-6">
        {overdue.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-red-600 flex items-center gap-1">
              <Clock className="h-4 w-4" /> Overdue
            </h2>
            {overdue.map((d) => (
              <DueRow key={d.id} due={d} onPay={handlePay} isPending={isPending} />
            ))}
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Upcoming (30 days)</h2>
            {upcoming.map((d) => (
              <DueRow key={d.id} due={d} onPay={handlePay} isPending={isPending} />
            ))}
          </section>
        )}

        {dues.length === 0 && !isPending && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p>All clear — no upcoming dues.</p>
          </div>
        )}
      </div>
    </ContentLayout>
  );
}

function DueRow({
  due,
  onPay,
  isPending,
}: {
  due: DueEntry;
  onPay: (id: string) => void;
  isPending: boolean;
}) {
  const isExpense = due.direction === "EXPENSE";
  const isOverdue = new Date(due.dueDate) < new Date();
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{due.description}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(due.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {due.walletName && ` · ${due.walletName}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-sm font-semibold ${isExpense ? "text-red-600" : "text-green-600"}`}>
              ₹{due.amount.toLocaleString("en-IN")}
            </p>
            {due.status === "PARTIAL" && (
              <p className="text-xs text-muted-foreground">
                paid ₹{due.paidAmount.toLocaleString("en-IN")}
              </p>
            )}
          </div>
          <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
            {due.status}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => onPay(due.id)} disabled={isPending}>
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
