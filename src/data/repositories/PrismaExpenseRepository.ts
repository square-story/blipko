import { Bucket, Expense, PrismaClient } from "@prisma/client";
import {
  CreateExpenseDTO,
  IExpenseRepository,
} from "../../domain/repositories/IExpenseRepository";

export class PrismaExpenseRepository implements IExpenseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateExpenseDTO): Promise<Expense> {
    return this.prisma.expense.create({
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

  async softDelete(id: string): Promise<void> {
    await this.prisma.expense.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
