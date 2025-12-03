import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type GetContactsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string; // e.g., "name.asc" or "totalSpend.desc"
};

import { auth } from "@/auth";

export async function getContacts({
  page = 1,
  pageSize = 10,
  search,
  sort,
}: GetContactsParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return { data: [], pageCount: 0, total: 0 };
  }
  const userId = session.user.id;

  const skip = (page - 1) * pageSize;

  const where: Prisma.ContactWhereInput = {
    userId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Handle sorting
  let orderBy: Prisma.ContactOrderByWithRelationInput = { createdAt: "desc" };
  if (sort) {
    const [field, direction] = sort.split(".");
    if (field === "totalSpend") {
      // Fallback to name sorting as totalSpend is aggregated
      orderBy = { name: direction as "asc" | "desc" };
    } else {
      orderBy = { [field]: direction as "asc" | "desc" };
    }
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        _count: {
          select: { transactions: true },
        },
        transactions: {
          select: {
            amount: true,
            date: true,
          },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  // Calculate total spend and last transaction for each contact
  const contactsWithStats = contacts.map((contact) => {
    const totalSpend = contact.transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const lastTransaction = contact.transactions.sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    )[0]?.date;

    // Remove transactions from the result to avoid passing Decimal objects to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transactions, currentBalance, ...rest } = contact;

    return {
      ...rest,
      currentBalance: Number(currentBalance),
      totalSpend,
      lastTransaction,
      transactionCount: contact._count.transactions,
    };
  });

  // In-memory sort for totalSpend
  if (sort?.startsWith("totalSpend")) {
    const direction = sort.split(".")[1];
    contactsWithStats.sort((a, b) => {
      return direction === "asc"
        ? a.totalSpend - b.totalSpend
        : b.totalSpend - a.totalSpend;
    });
  }

  const pageCount = Math.ceil(total / pageSize);

  return {
    data: contactsWithStats,
    pageCount,
    total,
  };
}

export async function getContactStats() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      totalVendors: 0,
      activeVendors: 0,
      newVendors: 0,
      totalSpend: 0,
    };
  }
  const userId = session.user.id;

  const [totalVendors, activeVendors, newVendors] = await Promise.all([
    prisma.contact.count({ where: { userId } }),
    // Use string "ACTIVE" to avoid runtime error if Enum is undefined
    prisma.contact.count({ where: { userId, status: "ACTIVE" as any } }),
    prisma.contact.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
      },
    }),
  ]);

  // Total spend across all contacts
  const totalSpendResult = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
      contactId: { not: null },
    },
  });

  return {
    totalVendors,
    activeVendors,
    newVendors,
    totalSpend: Number(totalSpendResult._sum.amount || 0),
  };
}
