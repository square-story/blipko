import { Bucket, Expense, Prisma, PrismaClient } from "@prisma/client";
import {
  CreateExpenseDTO,
  IExpenseRepository,
  RecentExpenseFilter,
  RecentExpenseRow,
} from "../../domain/repositories/IExpenseRepository";
import { TxClient } from "../../domain/repositories/UnitOfWork";

export class PrismaExpenseRepository implements IExpenseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateExpenseDTO, tx?: TxClient): Promise<Expense> {
    return (tx ?? this.prisma).expense.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        bucket: data.bucket,
        note: data.note ?? null,
        rawText: data.rawText,
        confidence: data.confidence,
        source: data.source ?? "TEXT",
        categoryId: data.categoryId ?? null,
        parseLogId: data.parseLogId ?? null,
      },
    });
  }

  async findById(id: string): Promise<Expense | null> {
    return this.prisma.expense.findUnique({ where: { id } });
  }

  async findLastByUserId(userId: string): Promise<Expense | null> {
    return this.prisma.expense.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  async findByConfirmationMessageId(
    messageId: string,
    userId: string,
  ): Promise<Expense | null> {
    return this.prisma.expense.findFirst({
      where: { confirmationMessageId: messageId, userId, isDeleted: false },
    });
  }

  async updateConfirmationMessageId(
    expenseId: string,
    messageId: string,
  ): Promise<void> {
    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { confirmationMessageId: messageId },
    });
  }

  async sumByBucketForMonth(
    userId: string,
    bucket: Bucket,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        bucket,
        isDeleted: false,
        date: { gte: monthStart, lt: monthEnd },
      },
    });
    return Number(result._sum.amount ?? 0);
  }

  async topCategoriesForMonth(
    userId: string,
    bucket: Bucket,
    monthStart: Date,
    monthEnd: Date,
    limit: number,
  ): Promise<Array<{ name: string; total: number }>> {
    const groups = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        bucket,
        isDeleted: false,
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });

    const ids = groups
      .map((g) => g.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: ids } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return groups.map((g) => ({
      name: g.categoryId
        ? (nameById.get(g.categoryId) ?? "Other")
        : "Uncategorized",
      total: Number(g._sum.amount ?? 0),
    }));
  }

  async categoryTotals(
    userId: string,
    from: Date,
    to: Date,
    bucket: Bucket | null,
    limit: number,
  ): Promise<Array<{ name: string; total: number }>> {
    const groups = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        isDeleted: false,
        date: { gte: from, lt: to },
        ...(bucket ? { bucket } : {}),
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });

    const ids = groups
      .map((g) => g.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: ids } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return groups.map((g) => ({
      name: g.categoryId
        ? (nameById.get(g.categoryId) ?? "Other")
        : "Uncategorized",
      total: Number(g._sum.amount ?? 0),
    }));
  }

  async findRecent(
    userId: string,
    opts: RecentExpenseFilter,
  ): Promise<RecentExpenseRow[]> {
    const where: Prisma.ExpenseWhereInput = { userId, isDeleted: false };

    if (opts.categoryName) {
      const category = await this.prisma.category.findFirst({
        where: {
          name: { equals: opts.categoryName, mode: "insensitive" },
          OR: [{ userId: null }, { userId }],
        },
      });
      // Unknown category → no matches rather than ignoring the filter.
      if (!category) return [];
      where.categoryId = category.id;
    }

    if (opts.from || opts.to) {
      where.date = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lt: opts.to } : {}),
      };
    }

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      take: opts.limit,
      include: { category: true },
    });

    return rows.map((r) => ({
      date: r.date,
      amount: Number(r.amount),
      bucket: r.bucket,
      categoryName: r.category?.name ?? "Uncategorized",
      note: r.note,
    }));
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.expense.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
