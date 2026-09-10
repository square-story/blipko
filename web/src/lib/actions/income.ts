"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  incomeEditSchema,
  type IncomeEditInput,
} from "@/lib/validations/income";
import { currentBudgetPeriod } from "@/lib/budget";

export type IncomeData = {
  id: string;
  amount: number;
  source: string | null;
  note: string | null;
  date: Date;
  categoryId: string | null;
  categoryName: string | null;
};

// The 13 seeded system rows. There is no per-user income taxonomy and there is
// not meant to be one, so this is the same list for everybody.
export type IncomeCategoryOption = {
  id: string;
  name: string;
  countsAsEarnings: boolean;
};

export type IncomeFilters = {
  search?: string;
  from?: string; // epoch ms
  to?: string; // epoch ms
  categoryId?: string; // dot-separated ids, multi-select
};

function buildWhere(
  userId: string,
  { search, from, to, categoryId }: IncomeFilters,
): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = {
    userId,
    isDeleted: false,
    OR: search
      ? [
          { source: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
          { rawText: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  };

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(Number(from));
    if (to) where.date.lte = new Date(Number(to) + 86_399_999);
  }

  if (categoryId) {
    const ids = categoryId.split(".");
    if (ids.length > 0) where.categoryId = { in: ids };
  }

  return where;
}

export async function getIncome({
  page = 1,
  limit = 10,
  search = "",
  sort = "date.desc",
  from,
  to,
  categoryId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  from?: string;
  to?: string;
  categoryId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Unauthorized",
      data: [] as IncomeData[],
      total: 0,
      totalAmount: 0,
      pageCount: 0,
    };
  }

  limit = Math.min(Math.max(1, Math.floor(limit)), 100);
  page = Math.max(1, Math.floor(page));

  const skip = (page - 1) * limit;
  const ALLOWED_SORT_FIELDS = ["date", "amount", "createdAt"] as const;
  type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];
  const [rawSortField, rawSortOrder] = sort.split(".");
  const sortField: AllowedSortField = ALLOWED_SORT_FIELDS.includes(
    rawSortField as AllowedSortField,
  )
    ? (rawSortField as AllowedSortField)
    : "date";
  const sortOrder: Prisma.SortOrder = rawSortOrder === "asc" ? "asc" : "desc";
  const orderBy: Prisma.IncomeOrderByWithRelationInput = {
    [sortField]: sortOrder,
  };

  const where = buildWhere(session.user.id, { search, from, to, categoryId });

  try {
    const [total, amountAgg, incomes] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.aggregate({ where, _sum: { amount: true } }),
      prisma.income.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { category: { select: { name: true } } },
      }),
    ]);

    const data: IncomeData[] = incomes.map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      source: i.source,
      note: i.note,
      date: i.date,
      categoryId: i.categoryId,
      categoryName: i.category?.name ?? null,
    }));

    return {
      success: true,
      data,
      total,
      totalAmount: Number(amountAgg._sum.amount ?? 0),
      pageCount: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error fetching income:", error);
    return {
      success: false,
      message: "Failed to fetch income",
      data: [] as IncomeData[],
      total: 0,
      totalAmount: 0,
      pageCount: 0,
    };
  }
}

export async function deleteIncome(ids: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  if (!ids.length) return { success: false, message: "No income selected" };
  if (ids.length > 100)
    return { success: false, message: "Cannot delete more than 100 at once" };

  await prisma.income.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  revalidateIncome();
  return { success: true };
}

export async function updateIncome(id: string, input: IncomeEditInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsed = incomeEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { amount, date, source, note, categoryId } = parsed.data;

  const income = await prisma.income.findUnique({
    where: { id, userId: session.user.id },
  });
  if (!income) return { success: false, message: "Income not found" };

  // findFirst + OR, not findUnique({ id, userId }) as the expense side does:
  // IncomeCategory.userId is nullable and every system row has it null, so an
  // ownership check would reject the entire taxonomy.
  let categoryUpdate: { categoryId?: string } = {};
  if (categoryId) {
    const category = await prisma.incomeCategory.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId: null }, { userId: session.user.id }],
      },
      select: { id: true },
    });
    if (!category) return { success: false, message: "Category not found" };
    categoryUpdate = { categoryId: category.id };
  }

  await prisma.income.update({
    where: { id },
    data: {
      amount,
      date,
      source: source || null,
      note: note || null,
      ...categoryUpdate,
    },
  });

  revalidateIncome();
  return { success: true };
}

// Editing or deleting an income moves the budget basis, so every surface built
// on it has to be refreshed — not just the income table.
function revalidateIncome(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/categories/income");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportIncomeCsv(
  filters: IncomeFilters,
): Promise<{ success: boolean; csv?: string; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const where = buildWhere(session.user.id, filters);
  const incomes = await prisma.income.findMany({
    where,
    orderBy: { date: "desc" },
    include: { category: { select: { name: true } } },
  });

  const header = ["Date", "Amount", "Category", "Source", "Note"];
  const rows = incomes.map((i) =>
    [
      i.date.toISOString().split("T")[0],
      String(Number(i.amount)),
      i.category?.name ?? "",
      i.source ?? "",
      i.note ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return { success: true, csv: [header.join(","), ...rows].join("\n") };
}

// System rows (userId = null) plus, for forward-compatibility, anything the user
// owns. Mirrors PrismaIncomeCategoryRepository.findAllForUser — that repository
// lives in the bot's src/ and is not importable from here, so the clause is
// copied rather than shared.
export async function getIncomeCategories(): Promise<IncomeCategoryOption[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.incomeCategory.findMany({
    where: { OR: [{ userId: null }, { userId: session.user.id }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, countsAsEarnings: true },
  });
}

export type IncomeCategoryTotals = {
  categories: (IncomeCategoryOption & { total: number })[];
  // Income with no category. It counts as earnings — that is exactly what the
  // NOT{countsAsEarnings:false} basis encodes — so the taxonomy page shows it
  // on the earning side rather than hiding it.
  uncategorised: number;
  currency: string;
  locale: string;
};

export async function getIncomeCategoryTotals(): Promise<IncomeCategoryTotals> {
  const session = await auth();
  const empty = {
    categories: [],
    uncategorised: 0,
    currency: "INR",
    locale: "en-IN",
  };
  if (!session?.user?.id) return empty;
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payday: true, currency: true, locale: true },
  });
  const { start, end } = currentBudgetPeriod(user?.payday ?? 1);

  const [categories, grouped] = await Promise.all([
    prisma.incomeCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, countsAsEarnings: true },
    }),
    prisma.income.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: { userId, isDeleted: false, date: { gte: start, lt: end } },
    }),
  ]);

  const totals = new Map(
    grouped.map((g) => [g.categoryId, Number(g._sum.amount ?? 0)]),
  );

  return {
    categories: categories.map((c) => ({ ...c, total: totals.get(c.id) ?? 0 })),
    uncategorised: totals.get(null) ?? 0,
    currency: user?.currency ?? "INR",
    locale: user?.locale ?? "en-IN",
  };
}
