"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export type TransactionData = {
  id: string;
  amount: number;
  currency: string;
  intent: "CREDIT" | "DEBIT" | "UNDO";
  description: string | null;
  category: string;
  date: Date;
  contactName: string | null;
  contactId: string | null;
};

export async function getTransactions({
  page = 1,
  limit = 10,
  search = "",
  sort = "date.desc",
  intent,
  category,
  from,
  to,
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  intent?: string; // Comma separated
  category?: string; // Comma separated
  from?: string; // ISO date string
  to?: string; // ISO date string
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Unauthorized",
      data: [],
      total: 0,
      pageCount: 0,
    };
  }

  const skip = (page - 1) * limit;
  const [sortField, sortOrder] = sort.split(".");
  const orderBy: Prisma.TransactionOrderByWithRelationInput = {};

  if (sortField && sortOrder) {
    if (sortField === "contact") {
      orderBy.contact = { name: sortOrder as Prisma.SortOrder };
    } else {
      orderBy[sortField as keyof Prisma.TransactionOrderByWithRelationInput] =
        sortOrder as Prisma.SortOrder;
    }
  } else {
    orderBy.date = "desc";
  }

  const where: Prisma.TransactionWhereInput = {
    userId: session.user.id,
    isDeleted: false,
    OR: search
      ? [
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { contact: { name: { contains: search, mode: "insensitive" } } },
        ]
      : undefined,
  };

  if (from || to) {
    where.date = {};
    if (from) {
      where.date.gte = new Date(Number(from));
    }
    if (to) {
      where.date.lte = new Date(Number(to));
    }
  }

  if (intent) {
    const intents = intent.split(".") as ("CREDIT" | "DEBIT" | "UNDO")[];
    if (intents.length > 0) {
      where.intent = { in: intents };
    }
  }

  if (category) {
    const categories = category.split(".");
    if (categories.length > 0) {
      where.category = { in: categories };
    }
  }

  try {
    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: {
          contact: {
            select: {
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const formattedTransactions: TransactionData[] = transactions.map((tx) => ({
      id: tx.id,
      amount: Number(tx.amount),
      currency: tx.currency,
      intent: tx.intent,
      description: tx.description,
      category: tx.category,
      date: tx.date,
      contactName: tx.contact?.name || null,
      contactId: tx.contactId,
    }));

    return {
      success: true,
      data: formattedTransactions,
      total,
      pageCount: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      success: false,
      message: "Failed to fetch transactions",
      data: [],
      total: 0,
      pageCount: 0,
    };
  }
}
