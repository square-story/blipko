import { Income, PrismaClient } from "@prisma/client";
import {
  CreateIncomeDTO,
  IIncomeRepository,
} from "../../domain/repositories/IIncomeRepository";
import { TxClient } from "../../domain/repositories/UnitOfWork";

export class PrismaIncomeRepository implements IIncomeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateIncomeDTO, tx?: TxClient): Promise<Income> {
    return (tx ?? this.prisma).income.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        rawText: data.rawText,
        confidence: data.confidence,
        source: data.source ?? null,
        note: data.note ?? null,
        batchId: data.batchId ?? null,
      },
    });
  }

  async sumForMonth(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number> {
    const result = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        isDeleted: false,
        date: { gte: monthStart, lt: monthEnd },
      },
    });
    return Number(result._sum.amount ?? 0);
  }

  async findLastByUserId(userId: string): Promise<Income | null> {
    return this.prisma.income.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  async findByBatchId(batchId: string, userId: string): Promise<Income[]> {
    return this.prisma.income.findMany({
      where: { batchId, userId, isDeleted: false },
    });
  }

  async softDeleteByBatchId(batchId: string, userId: string): Promise<void> {
    await this.prisma.income.updateMany({
      where: { batchId, userId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.income.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
