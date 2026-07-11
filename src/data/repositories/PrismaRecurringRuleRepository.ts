import { PrismaClient, RecurringRule } from "@prisma/client";
import {
  CreateRecurringRuleDTO,
  IRecurringRuleRepository,
} from "../../domain/repositories/IRecurringRuleRepository";
import { TxClient } from "../../domain/repositories/UnitOfWork";

export class PrismaRecurringRuleRepository implements IRecurringRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRecurringRuleDTO): Promise<RecurringRule> {
    return this.prisma.recurringRule.create({
      data: {
        userId: data.userId,
        kind: data.kind,
        amount: data.amount,
        dayOfMonth: data.dayOfMonth,
        bucket: data.bucket ?? null,
        categoryId: data.categoryId ?? null,
        boxId: data.boxId ?? null,
        note: data.note ?? null,
      },
    });
  }

  async findByUserId(userId: string): Promise<RecurringRule[]> {
    return this.prisma.recurringRule.findMany({
      where: { userId, isActive: true },
      orderBy: { dayOfMonth: "asc" },
    });
  }

  async findById(id: string): Promise<RecurringRule | null> {
    return this.prisma.recurringRule.findUnique({ where: { id } });
  }

  async findAllActive(): Promise<RecurringRule[]> {
    return this.prisma.recurringRule.findMany({
      where: { isActive: true },
      orderBy: { dayOfMonth: "asc" },
    });
  }

  async markPosted(id: string, monthKey: string, tx?: TxClient): Promise<void> {
    await (tx ?? this.prisma).recurringRule.update({
      where: { id },
      data: { lastPostedKey: monthKey },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.recurringRule.deleteMany({ where: { id, userId } });
  }
}
