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

  // 1. Total Receivables: Sum(Contact.currentBalance) where balance < 0
  const receivablesAgg = await prisma.contact.aggregate({
    _sum: {
      currentBalance: true,
    },
    where: {
      userId,
      currentBalance: {
        lt: 0,
      },
    },
  });
  // Result is negative, so we might want to display it as a positive "Receivable" amount or keep it negative.
  // Usually "Receivables" implies money owed TO us.
  // If balance < 0 means they owe us (based on "Pending Invoices" logic), then the sum is negative.
  // I'll return the raw value and handle display in UI.
  const totalReceivables = receivablesAgg._sum.currentBalance?.toNumber() || 0;

  // 2. Cash Flow (This Month): Total In vs. Total Out
  const cashFlowAgg = await prisma.transaction.groupBy({
    by: ["intent"],
    _sum: {
      amount: true,
    },
    where: {
      userId,
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
    if (group.intent === "CREDIT") {
      totalIn += amount;
    } else if (group.intent === "DEBIT") {
      totalOut += amount;
    }
  });

  // 3. Chart Data: Income vs Expense Bar Chart
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
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

    if (t.intent === "CREDIT") {
      entry.income += amount;
    } else if (t.intent === "DEBIT") {
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

  // 4. Pending Invoices: Contacts with high negative balances
  const pendingInvoices = await prisma.contact.findMany({
    where: {
      userId,
      currentBalance: {
        lt: -1000, // Threshold
      },
    },
    orderBy: {
      currentBalance: "asc", // Most negative first
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

export async function sendWhatsAppReminder(contactId: string) {
  // Placeholder for bot integration
  console.log(`Sending WhatsApp reminder to contact ${contactId}`);
  // In a real app, this would call an external API or trigger a bot event
  await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay
  return { success: true, message: "Reminder sent successfully" };
}
