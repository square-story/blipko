import { PrismaClient, RecurringCharge } from "@prisma/client";
import {
  IRecurringChargeRepository,
  CreateRecurringChargeDTO,
} from "../../domain/repositories/IRecurringChargeRepository";

export class PrismaRecurringChargeRepository implements IRecurringChargeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRecurringChargeDTO): Promise<RecurringCharge> {
    return this.prisma.recurringCharge.create({
      data: {
        userId: data.userId,
        contactId: data.contactId ?? null,
        walletId: data.walletId ?? null,
        amount: data.amount,
        amountMin: data.amountMin ?? null,
        amountMax: data.amountMax ?? null,
        direction: data.direction,
        description: data.description,
        period: data.period,
        dayOfMonth: data.dayOfMonth,
        notifyDaysBefore: data.notifyDaysBefore ?? 2,
        startDate: new Date(),
      },
    });
  }

  async findByUserId(userId: string): Promise<RecurringCharge[]> {
    return this.prisma.recurringCharge.findMany({
      where: { userId, isActive: true, isDeleted: false },
      orderBy: { dayOfMonth: "asc" },
    });
  }

  async findDueForNotification(
    beforeDate: Date,
  ): Promise<(RecurringCharge & { user: { telegramId: string | null } })[]> {
    const charges = await this.prisma.recurringCharge.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        dues: {
          some: {
            dueDate: { lte: beforeDate },
            status: { in: ["PENDING", "PARTIAL"] },
            notifiedAt: null,
          },
        },
      },
      include: { user: { select: { telegramId: true } } },
    });
    return charges;
  }

  async markNotified(id: string): Promise<void> {
    await this.prisma.recurringCharge.update({
      where: { id },
      data: { lastNotifiedAt: new Date() },
    });
  }

  async findAllActive(): Promise<RecurringCharge[]> {
    return this.prisma.recurringCharge.findMany({
      where: { isActive: true, isDeleted: false },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.recurringCharge.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
