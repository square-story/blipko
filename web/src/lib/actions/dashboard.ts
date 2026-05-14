"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getDashboardData() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasOnboarded: true },
  });
  const hasOnboarded = user?.hasOnboarded ?? false;

  // Receivables: contacts where currentBalance > 0 means they owe the user
  const receivablesAgg = await prisma.contact.aggregate({
    _sum: {
      currentBalance: true,
    },
    where: {
      userId,
      currentBalance: {
        gt: 0,
      },
    },
  });
  const totalReceivables = receivablesAgg._sum.currentBalance?.toNumber() || 0;

  // 2. Cash Flow (This Month): Total In vs. Total Out
  // groupId: null ensures personal transactions only (group member txns excluded)
  const cashFlowAgg = await prisma.transaction.groupBy({
    by: ["intent"],
    _sum: {
      amount: true,
    },
    where: {
      userId,
      groupId: null,
      date: {
        gte: startOfMonth,
      },
      isDeleted: false,
    },
  });

  let totalIn = 0;
  let totalOut = 0;

  cashFlowAgg.forEach((group) => {
    const amount = group._sum.amount?.toNumber() || 0;
    if (group.intent === "RECEIVED") {
      totalIn += amount;
    } else if (group.intent === "PAID") {
      totalOut += amount;
    }
  });

  // 3. Chart Data: Income vs Expense Bar Chart
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      groupId: null,
      date: {
        gte: startOfMonth,
      },
      isDeleted: false,
    },
    select: {
      date: true,
      amount: true,
      intent: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  // Group by day
  const chartDataMap = new Map<string, { income: number; expense: number }>();

  // Initialize all days of the month so far
  const tempDate = new Date(startOfMonth);
  while (tempDate <= now) {
    const dateStr = tempDate.toISOString().split("T")[0];
    chartDataMap.set(dateStr, { income: 0, expense: 0 });
    tempDate.setDate(tempDate.getDate() + 1);
  }

  transactions.forEach((t) => {
    const dateStr = t.date.toISOString().split("T")[0];
    const amount = t.amount.toNumber();

    // Ensure the date exists in map (in case transaction is from today but loop missed it due to time, or future date if logic changes)
    if (!chartDataMap.has(dateStr)) {
      chartDataMap.set(dateStr, { income: 0, expense: 0 });
    }

    const entry = chartDataMap.get(dateStr)!;

    if (t.intent === "RECEIVED") {
      entry.income += amount;
    } else if (t.intent === "PAID") {
      entry.expense += amount;
    }
  });

  const chartData = Array.from(chartDataMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      income: values.income,
      expense: values.expense,
    }));

  // Pending Invoices: contacts who owe the user (currentBalance > 0)
  const pendingInvoices = await prisma.contact.findMany({
    where: {
      userId,
      currentBalance: {
        gt: 0,
      },
    },
    orderBy: {
      currentBalance: "desc",
    },
    take: 5,
  });

  const serializedPendingInvoices = pendingInvoices.map((contact) => ({
    ...contact,
    currentBalance: contact.currentBalance.toNumber(),
  }));

  return {
    totalReceivables,
    cashFlow: {
      in: totalIn,
      out: totalOut,
    },
    chartData,
    pendingInvoices: serializedPendingInvoices,
    hasOnboarded,
  };
}

export async function sendWhatsAppReminder(_contactId: string) {
  return { success: false, message: "Reminder feature not yet available" };
}
