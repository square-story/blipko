"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getAnalyticsData(months: number = 6) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // Monthly income vs expense trend
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate },
      isDeleted: false,
    },
    select: {
      date: true,
      amount: true,
      intent: true,
      category: true,
    },
  });

  type MonthEntry = {
    month: string;
    totalIn: number;
    totalOut: number;
    categoryBreakdown: Record<string, number>;
  };
  const monthMap = new Map<string, MonthEntry>();

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });
    monthMap.set(key, {
      month: label,
      totalIn: 0,
      totalOut: 0,
      categoryBreakdown: {},
    });
  }

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key);
    if (!entry) continue;
    const amount = tx.amount.toNumber();
    if (tx.intent === "RECEIVED") {
      entry.totalIn += amount;
    } else if (tx.intent === "PAID") {
      entry.totalOut += amount;
      const cat = tx.category || "General";
      entry.categoryBreakdown[cat] =
        (entry.categoryBreakdown[cat] || 0) + amount;
    }
  }

  const monthlyTrend = Array.from(monthMap.values());

  // Overdue contacts: currentBalance > 0 means they owe the user
  const overdueContacts = await prisma.contact.findMany({
    where: {
      userId,
      currentBalance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      category: true,
      currentBalance: true,
      updatedAt: true,
    },
    orderBy: { currentBalance: "desc" },
    take: 20,
  });

  const serializedOverdue = overdueContacts.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    balance: c.currentBalance.toNumber(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  // Category breakdown (current month)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthTx = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: thisMonthStart },
      intent: "PAID",
      isDeleted: false,
    },
    select: { category: true, amount: true },
  });

  const categoryMap = new Map<string, number>();
  for (const tx of thisMonthTx) {
    const cat = tx.category || "General";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + tx.amount.toNumber());
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top contacts by transaction volume
  const contactVolume = await prisma.transaction.groupBy({
    by: ["contactId"],
    _sum: { amount: true },
    _count: { id: true },
    where: {
      userId,
      contactId: { not: null },
      isDeleted: false,
    },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  });

  const contactIds = contactVolume
    .map((r) => r.contactId)
    .filter(Boolean) as string[];
  const contactDetails = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, name: true },
  });
  const contactMap = new Map(contactDetails.map((c) => [c.id, c.name]));

  const topContacts = contactVolume.map((r) => ({
    name: contactMap.get(r.contactId!) ?? "Unknown",
    total: r._sum.amount?.toNumber() ?? 0,
    count: r._count.id,
  }));

  return {
    monthlyTrend,
    overdueContacts: serializedOverdue,
    categoryBreakdown,
    topContacts,
  };
}
