"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [user, receivablesAgg, cashFlowAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { hasOnboarded: true },
    }),
    prisma.contact.aggregate({
      _sum: { currentBalance: true },
      where: { userId, currentBalance: { gt: 0 } },
    }),
    prisma.transaction.groupBy({
      by: ["intent"],
      _sum: { amount: true },
      where: {
        userId,
        groupId: null,
        date: { gte: startOfMonth },
        isDeleted: false,
      },
    }),
  ]);

  let totalIn = 0;
  let totalOut = 0;
  cashFlowAgg.forEach((g) => {
    const amt = g._sum.amount?.toNumber() || 0;
    if (g.intent === "RECEIVED") totalIn += amt;
    else if (g.intent === "PAID") totalOut += amt;
  });

  return {
    totalReceivables: receivablesAgg._sum.currentBalance?.toNumber() || 0,
    cashFlow: { in: totalIn, out: totalOut },
    hasOnboarded: user?.hasOnboarded ?? false,
  };
}

export async function getDashboardChartData() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      groupId: null,
      date: { gte: startOfMonth },
      isDeleted: false,
    },
    select: { date: true, amount: true, intent: true },
    orderBy: { date: "asc" },
  });

  const chartDataMap = new Map<string, { income: number; expense: number }>();
  const tempDate = new Date(startOfMonth);
  while (tempDate <= now) {
    chartDataMap.set(tempDate.toISOString().split("T")[0], {
      income: 0,
      expense: 0,
    });
    tempDate.setDate(tempDate.getDate() + 1);
  }

  transactions.forEach((t) => {
    const dateStr = t.date.toISOString().split("T")[0];
    if (!chartDataMap.has(dateStr))
      chartDataMap.set(dateStr, { income: 0, expense: 0 });
    const entry = chartDataMap.get(dateStr)!;
    if (t.intent === "RECEIVED") entry.income += t.amount.toNumber();
    else if (t.intent === "PAID") entry.expense += t.amount.toNumber();
  });

  return Array.from(chartDataMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      income: values.income,
      expense: values.expense,
    }));
}

export async function getDashboardPendingInvoices() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const contacts = await prisma.contact.findMany({
    where: { userId, currentBalance: { gt: 0 } },
    select: { id: true, name: true, currentBalance: true },
    orderBy: { currentBalance: "desc" },
    take: 5,
  });

  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    currentBalance: c.currentBalance.toNumber(),
  }));
}

export async function sendWhatsAppReminder(_contactId: string) {
  return { success: false, message: "Reminder feature not yet available" };
}
