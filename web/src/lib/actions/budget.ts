"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Bucket } from "@prisma/client";
import {
  BUCKETS,
  DEFAULT_SPLIT,
  bucketBudget,
  currentBudgetPeriod,
  periodDayInfo,
  effectiveMonthlyIncome,
  pctSpent,
  type BudgetSplit,
} from "@/lib/budget";

export type BucketOverview = {
  bucket: Bucket;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
};

export async function getBudgetOverview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  // Fetch the user first so the budget window can follow their payday cycle.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      monthlyIncome: true,
      currency: true,
      locale: true,
      hasOnboarded: true,
      payday: true,
    },
  });
  const { start, end } = currentBudgetPeriod(user?.payday ?? 1);
  const { day, daysInPeriod, remainingDays } = periodDayInfo(user?.payday ?? 1);

  const [config, grouped, recent, categoryGroups, incomeAgg] =
    await Promise.all([
      prisma.budgetConfig.findUnique({ where: { userId } }),
      prisma.expense.groupBy({
        by: ["bucket"],
        _sum: { amount: true },
        where: { userId, isDeleted: false, date: { gte: start, lt: end } },
      }),
      prisma.expense.findMany({
        where: { userId, isDeleted: false, date: { gte: start, lt: end } },
        include: { category: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 8,
      }),
      prisma.expense.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        where: { userId, isDeleted: false, date: { gte: start, lt: end } },
      }),
      prisma.income.aggregate({
        _sum: { amount: true },
        where: { userId, isDeleted: false, date: { gte: start, lt: end } },
      }),
    ]);

  const expectedIncome = Number(user?.monthlyIncome ?? 0);
  const incomeThisMonth = Number(incomeAgg._sum.amount ?? 0);
  // Budgets track actual income this month, floored at the expected salary.
  const monthlyIncome = effectiveMonthlyIncome(expectedIncome, incomeThisMonth);
  const currency = user?.currency ?? "INR";
  const locale = user?.locale ?? "en-IN";
  const split: BudgetSplit = config
    ? {
        needsPct: config.needsPct,
        wantsPct: config.wantsPct,
        savingsPct: config.savingsPct,
      }
    : DEFAULT_SPLIT;

  const spentByBucket = new Map<Bucket, number>();
  for (const g of grouped) {
    spentByBucket.set(g.bucket, Number(g._sum.amount ?? 0));
  }

  const buckets: BucketOverview[] = BUCKETS.map((bucket) => {
    const budget = bucketBudget(monthlyIncome, split, bucket);
    const spent = spentByBucket.get(bucket) ?? 0;
    return {
      bucket,
      budget,
      spent,
      remaining: budget - spent,
      pct: pctSpent(spent, budget),
    };
  });

  const totalSpent = buckets.reduce((sum, b) => sum + b.spent, 0);
  const savings = buckets.find((b) => b.bucket === "SAVINGS")!;

  // Category breakdown for the current month (named, spend desc).
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

  const recentExpenses = recent.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    bucket: e.bucket,
    categoryName: e.category?.name ?? null,
    note: e.note,
    date: e.date,
  }));

  // Human label for the current cycle, e.g. "Jun 25 – Jul 24".
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });
  const periodLabel = `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 86400000))}`;

  return {
    monthlyIncome,
    expectedIncome,
    incomeThisMonth,
    periodLabel,
    day,
    daysInPeriod,
    remainingDays,
    currency,
    locale,
    split,
    buckets,
    totalSpent,
    savingsProgress: {
      saved: savings.spent,
      target: savings.budget,
      pct: savings.pct,
    },
    recentExpenses,
    categoryBreakdown,
    hasOnboarded: user?.hasOnboarded ?? false,
  };
}

export async function getBudgetSettings() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [user, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        monthlyIncome: true,
        payday: true,
        currency: true,
        locale: true,
        notificationDosage: true,
      },
    }),
    prisma.budgetConfig.findUnique({ where: { userId } }),
  ]);

  return {
    monthlyIncome: user?.monthlyIncome ? Number(user.monthlyIncome) : 0,
    payday: user?.payday ?? 1,
    currency: user?.currency ?? "INR",
    locale: user?.locale ?? "en-IN",
    needsPct: config?.needsPct ?? DEFAULT_SPLIT.needsPct,
    wantsPct: config?.wantsPct ?? DEFAULT_SPLIT.wantsPct,
    savingsPct: config?.savingsPct ?? DEFAULT_SPLIT.savingsPct,
    notificationDosage: user?.notificationDosage ?? "OFF",
  };
}

const settingsSchema = z
  .object({
    monthlyIncome: z.number().min(0).max(1_000_000_000).optional(),
    payday: z.number().int().min(1).max(28).optional(),
    currency: z.string().min(1).max(8).optional(),
    locale: z.string().min(2).max(16).optional(),
    needsPct: z.number().int().min(0).max(100).optional(),
    wantsPct: z.number().int().min(0).max(100).optional(),
    savingsPct: z.number().int().min(0).max(100).optional(),
    notificationDosage: z
      .enum(["OFF", "GENTLE", "AGGRESSIVE", "RELENTLESS"])
      .optional(),
  })
  .refine(
    (d) => {
      const pcts = [d.needsPct, d.wantsPct, d.savingsPct];
      const provided = pcts.filter((p) => p !== undefined);
      if (provided.length === 0) return true;
      if (provided.length !== 3) return false;
      return d.needsPct! + d.wantsPct! + d.savingsPct! === 100;
    },
    {
      message:
        "The 50/30/20 split must include all three values and sum to 100",
    },
  );

export async function updateBudgetSettings(input: {
  monthlyIncome?: number;
  payday?: number;
  currency?: string;
  locale?: string;
  needsPct?: number;
  wantsPct?: number;
  savingsPct?: number;
  notificationDosage?: "OFF" | "GENTLE" | "AGGRESSIVE" | "RELENTLESS";
}): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid settings",
    };
  }
  const d = parsed.data;
  const userId = session.user.id;

  const userData: {
    monthlyIncome?: number;
    payday?: number;
    currency?: string;
    locale?: string;
    notificationDosage?: "OFF" | "GENTLE" | "AGGRESSIVE" | "RELENTLESS";
  } = {};
  if (d.monthlyIncome !== undefined) userData.monthlyIncome = d.monthlyIncome;
  if (d.payday !== undefined) userData.payday = d.payday;
  if (d.currency !== undefined) userData.currency = d.currency;
  if (d.locale !== undefined) userData.locale = d.locale;
  if (d.notificationDosage !== undefined)
    userData.notificationDosage = d.notificationDosage;

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userData });
  }

  if (d.needsPct !== undefined) {
    await prisma.budgetConfig.upsert({
      where: { userId },
      create: {
        userId,
        needsPct: d.needsPct,
        wantsPct: d.wantsPct!,
        savingsPct: d.savingsPct!,
      },
      update: {
        needsPct: d.needsPct,
        wantsPct: d.wantsPct!,
        savingsPct: d.savingsPct!,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/account");
  return { success: true };
}
