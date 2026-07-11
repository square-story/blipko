"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Bucket, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  expenseEditSchema,
  type ExpenseEditInput,
} from "@/lib/validations/expense";
import { divertExpenseToLinkedBox } from "@/lib/box-transfer";

export type ExpenseData = {
  id: string;
  amount: number;
  bucket: Bucket;
  categoryId: string | null;
  categoryName: string | null;
  note: string | null;
  source: string;
  date: Date;
};

export type ExpenseFilters = {
  search?: string;
  bucket?: string; // dot-separated
  categoryId?: string; // dot-separated
  from?: string; // epoch ms
  to?: string; // epoch ms
};

function buildWhere(
  userId: string,
  { search, bucket, categoryId, from, to }: ExpenseFilters,
): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {
    userId,
    isDeleted: false,
    OR: search
      ? [
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

  if (bucket) {
    const buckets = bucket.split(".") as Bucket[];
    if (buckets.length > 0) where.bucket = { in: buckets };
  }

  if (categoryId) {
    const ids = categoryId.split(".");
    if (ids.length > 0) where.categoryId = { in: ids };
  }

  return where;
}

export async function getExpenses({
  page = 1,
  limit = 10,
  search = "",
  sort = "date.desc",
  bucket,
  categoryId,
  from,
  to,
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  bucket?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Unauthorized",
      data: [] as ExpenseData[],
      total: 0,
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
  const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
    [sortField]: sortOrder,
  };

  const where = buildWhere(session.user.id, {
    search,
    bucket,
    categoryId,
    from,
    to,
  });

  try {
    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const data: ExpenseData[] = expenses.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      bucket: e.bucket,
      categoryId: e.categoryId,
      categoryName: e.category?.name ?? null,
      note: e.note,
      source: e.source,
      date: e.date,
    }));

    return {
      success: true,
      data,
      total,
      pageCount: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return {
      success: false,
      message: "Failed to fetch expenses",
      data: [] as ExpenseData[],
      total: 0,
      pageCount: 0,
    };
  }
}

export async function deleteExpenses(ids: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  if (!ids.length) return { success: false, message: "No expenses selected" };
  if (ids.length > 100)
    return { success: false, message: "Cannot delete more than 100 at once" };

  await prisma.expense.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportExpensesCsv(
  filters: ExpenseFilters,
): Promise<{ success: boolean; csv?: string; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const where = buildWhere(session.user.id, filters);
  const expenses = await prisma.expense.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  const header = ["Date", "Amount", "Bucket", "Category", "Note", "Source"];
  const rows = expenses.map((e) =>
    [
      e.date.toISOString().split("T")[0],
      String(Number(e.amount)),
      e.bucket,
      e.category?.name ?? "",
      e.note ?? "",
      e.source,
    ]
      .map(csvCell)
      .join(","),
  );

  return { success: true, csv: [header.join(","), ...rows].join("\n") };
}

export async function getNeedsReviewExpenses() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const expenses = await prisma.expense.findMany({
    where: {
      userId: session.user.id,
      isDeleted: false,
      OR: [
        { confidence: { lt: 0.8 } },
        { categoryId: null },
        {
          category: {
            name: { in: ["Miscellaneous", "Other", "Uncategorized"] },
          },
        },
      ],
    },
    include: { category: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 10,
  });

  return expenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    bucket: e.bucket,
    categoryName: e.category?.name ?? null,
    note: e.note,
    source: e.source,
    date: e.date,
    confidence: e.confidence,
  }));
}

export async function assignExpenseCategory(
  expenseId: string,
  categoryId: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId, userId: session.user.id },
  });
  if (!expense) return { success: false, message: "Expense not found" };

  const category = await prisma.category.findUnique({
    where: { id: categoryId, userId: session.user.id },
  });
  if (!category) return { success: false, message: "Category not found" };

  // If the category feeds a box, transfer the transaction into that box
  // instead of tagging it (mirrors the bot's diversion).
  const transfer = await divertExpenseToLinkedBox(session.user.id, {
    expenseId,
    categoryId: category.id,
    amount: Number(expense.amount),
    note: expense.note,
    date: expense.date,
  });

  if (!transfer.transferred) {
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        categoryId: category.id,
        bucket: category.bucket,
        confidence: 1.0,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/boxes");
  return { success: true, movedToBox: transfer.boxName };
}

export async function updateExpense(id: string, input: ExpenseEditInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsed = expenseEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { amount, date, categoryId, note } = parsed.data;

  const expense = await prisma.expense.findUnique({
    where: { id, userId: session.user.id },
  });
  if (!expense) return { success: false, message: "Expense not found" };

  // Bucket is driven by the category. Pick one → adopt its bucket; clear it →
  // uncategorize but keep the existing bucket.
  let categoryUpdate: { categoryId: string | null; bucket?: Bucket };
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId, userId: session.user.id },
    });
    if (!category) return { success: false, message: "Category not found" };

    // Category feeds a box → transfer the (edited) transaction into it.
    const transfer = await divertExpenseToLinkedBox(session.user.id, {
      expenseId: id,
      categoryId: category.id,
      amount,
      note: note || null,
      date,
    });
    if (transfer.transferred) {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/expenses");
      revalidatePath("/dashboard/categories");
      revalidatePath("/dashboard/analytics");
      revalidatePath("/dashboard/boxes");
      return { success: true, movedToBox: transfer.boxName };
    }

    categoryUpdate = { categoryId: category.id, bucket: category.bucket };
  } else {
    categoryUpdate = { categoryId: null };
  }

  await prisma.expense.update({
    where: { id },
    data: { amount, date, note: note || null, ...categoryUpdate },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/analytics");
  return { success: true, movedToBox: undefined as string | undefined };
}
