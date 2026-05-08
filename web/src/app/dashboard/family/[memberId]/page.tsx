"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { getGroupMemberTransactions } from "@/lib/actions/group";

type Tx = {
  id: string;
  amount: number;
  intent: string;
  description: string | null;
  category: string;
  date: string;
  contactName: string | null;
};

export default function MemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await getGroupMemberTransactions(memberId);
      if (res.success) setTxs(res.data as Tx[]);
      setLoaded(true);
    });
  }, [memberId]);

  const totalSpend = txs
    .filter((t) => t.intent === "PAID")
    .reduce((s, t) => s + t.amount, 0);
  const totalReceived = txs
    .filter((t) => t.intent === "RECEIVED")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <ContentLayout title="Member Transactions">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/family">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Family
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-500" /> Total Spent
              </p>
              <p className="text-2xl font-bold text-red-600">
                ₹{totalSpend.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" /> Total Received
              </p>
              <p className="text-2xl font-bold text-green-600">
                ₹{totalReceived.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          {!loaded && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {loaded && txs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet.
            </p>
          )}
          {txs.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {t.description ?? t.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {t.contactName && ` · ${t.contactName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      t.intent === "PAID" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {t.intent === "PAID" ? "-" : "+"}₹
                    {t.amount.toLocaleString("en-IN")}
                  </span>
                  <Badge
                    variant={t.intent === "PAID" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {t.intent === "PAID" ? "Paid" : "Received"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ContentLayout>
  );
}
