"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Bucket } from "@prisma/client";
import { BUCKETS, currentMonthRange } from "@/lib/budget";

export async function getAnalyticsData(months: number = 6) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // Per-bucket spend + income per month over the window.
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({
      where: { userId, isDeleted: false, date: { gte: startDate } },
      select: { date: true, amount: true, bucket: true },
    }),
    prisma.income.findMany({
      where: { userId, isDeleted: false, date: { gte: startDate } },
      select: { date: true, amount: true },
    }),
  ]);

  type MonthEntry = {
    month: string;
    NEEDS: number;
    WANTS: number;
    SAVINGS: number;
  };
  const monthMap = new Map<string, MonthEntry>();
  const incomeMap = new Map<string, number>(); // monthKey → income total

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });
    monthMap.set(key, { month: label, NEEDS: 0, WANTS: 0, SAVINGS: 0 });
    incomeMap.set(key, 0);
  }

  for (const e of expenses) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key);
    if (!entry) continue;
    entry[e.bucket as Bucket] += Number(e.amount);
  }

  for (const i of incomes) {
    const key = `${i.date.getFullYear()}-${String(i.date.getMonth() + 1).padStart(2, "0")}`;
    if (incomeMap.has(key))
      incomeMap.set(key, incomeMap.get(key)! + Number(i.amount));
  }

  const monthlyTrend = Array.from(monthMap.values());

  // Income vs spending per month (net = income − spend).
  const incomeExpenseTrend = Array.from(monthMap.entries()).map(([key, m]) => {
    const spend = m.NEEDS + m.WANTS + m.SAVINGS;
    const income = incomeMap.get(key) ?? 0;
    return { month: m.month, income, spend, net: income - spend };
  });

  // Category breakdown (current month).
  const { start, end } = currentMonthRange(now);
  const categoryGroups = await prisma.expense.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: { userId, isDeleted: false, date: { gte: start, lt: end } },
  });

  const categoryIds = categoryGroups
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id);
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const categoryBreakdown = categoryGroups
    .map((g) => ({
      name: g.categoryId
        ? (nameById.get(g.categoryId) ?? "Uncategorized")
        : "Uncategorized",
      value: Number(g._sum.amount ?? 0),
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const topCategories = categoryBreakdown.slice(0, 5);

  // Current-month income + net (income − spend).
  const incomeAgg = await prisma.income.aggregate({
    _sum: { amount: true },
    where: { userId, isDeleted: false, date: { gte: start, lt: end } },
  });
  const incomeThisMonth = Number(incomeAgg._sum.amount ?? 0);
  const spentThisMonth = categoryBreakdown.reduce((s, c) => s + c.value, 0);
  const netThisMonth = incomeThisMonth - spentThisMonth;

  return {
    monthlyTrend,
    incomeExpenseTrend,
    buckets: BUCKETS,
    categoryBreakdown,
    topCategories,
    incomeThisMonth,
    spentThisMonth,
    netThisMonth,
  };
}
