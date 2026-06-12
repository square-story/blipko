"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type IncomeData = {
  id: string;
  amount: number;
  source: string | null;
  note: string | null;
  date: Date;
};

export type IncomeFilters = {
  search?: string;
  from?: string; // epoch ms
  to?: string; // epoch ms
};

function buildWhere(
  userId: string,
  { search, from, to }: IncomeFilters,
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
    if (to) where.date.lte = new Date(Number(to));
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
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  from?: string;
  to?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Unauthorized",
      data: [] as IncomeData[],
      total: 0,
      pageCount: 0,
    };
  }

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

  const where = buildWhere(session.user.id, { search, from, to });

  try {
    const [total, incomes] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.findMany({ where, orderBy, skip, take: limit }),
    ]);

    const data: IncomeData[] = incomes.map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      source: i.source,
      note: i.note,
      date: i.date,
    }));

    return { success: true, data, total, pageCount: Math.ceil(total / limit) };
  } catch (error) {
    console.error("Error fetching income:", error);
    return {
      success: false,
      message: "Failed to fetch income",
      data: [] as IncomeData[],
      total: 0,
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

  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard");
  return { success: true };
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
  });

  const header = ["Date", "Amount", "Source", "Note"];
  const rows = incomes.map((i) =>
    [
      i.date.toISOString().split("T")[0],
      String(Number(i.amount)),
      i.source ?? "",
      i.note ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return { success: true, csv: [header.join(","), ...rows].join("\n") };
}
