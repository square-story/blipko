import { PrismaClient, DueEntry } from "@prisma/client";
import {
  IDueEntryRepository,
  CreateDueEntryDTO,
} from "../../domain/repositories/IDueEntryRepository";

export class PrismaDueEntryRepository implements IDueEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDueEntryDTO): Promise<DueEntry> {
    return this.prisma.dueEntry.create({
      data: {
        chargeId: data.chargeId,
        contactId: data.contactId ?? null,
        walletId: data.walletId ?? null,
        dueDate: data.dueDate,
        amount: data.amount,
      },
    });
  }

  async createManySkipDuplicates(
    entries: CreateDueEntryDTO[],
  ): Promise<number> {
    const result = await this.prisma.dueEntry.createMany({
      data: entries.map((e) => ({
        chargeId: e.chargeId,
        contactId: e.contactId ?? null,
        walletId: e.walletId ?? null,
        dueDate: e.dueDate,
        amount: e.amount,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findPendingForCharge(chargeId: string): Promise<DueEntry[]> {
    return this.prisma.dueEntry.findMany({
      where: { chargeId, status: { in: ["PENDING", "PARTIAL"] } },
    });
  }

  async findUnnotified(upToDate: Date): Promise<
    (DueEntry & {
      charge: {
        id: string;
        description: string;
        amount: import("@prisma/client").Prisma.Decimal;
        userId: string;
        user: { telegramId: string | null; name: string | null };
      };
    })[]
  > {
    return this.prisma.dueEntry.findMany({
      where: {
        dueDate: { lte: upToDate },
        status: { in: ["PENDING", "PARTIAL"] },
        notifiedAt: null,
      },
      include: {
        charge: {
          include: {
            user: { select: { telegramId: true, name: true } },
          },
        },
      },
    });
  }

  async markNotified(id: string): Promise<void> {
    await this.prisma.dueEntry.update({
      where: { id },
      data: { notifiedAt: new Date() },
    });
  }

  async markPaid(id: string, paidAmount: number): Promise<void> {
    await this.prisma.dueEntry.update({
      where: { id },
      data: { paidAmount, status: "PAID", paidAt: new Date() },
    });
  }

  async snooze(id: string, days: number): Promise<void> {
    const entry = await this.prisma.dueEntry.findUnique({ where: { id } });
    if (!entry) return;
    const newDate = new Date(entry.dueDate);
    newDate.setDate(newDate.getDate() + days);
    await this.prisma.dueEntry.update({
      where: { id },
      data: { dueDate: newDate, notifiedAt: null },
    });
  }

  async findById(id: string): Promise<DueEntry | null> {
    return this.prisma.dueEntry.findUnique({ where: { id } });
  }
}
