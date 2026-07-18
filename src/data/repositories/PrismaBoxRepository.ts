import { Box, BoxEntry, PrismaClient } from "@prisma/client";
import {
  CreateBoxDTO,
  UpdateBoxDTO,
  CreateBoxEntryDTO,
  BoxWithBalance,
  IBoxRepository,
} from "../../domain/repositories/IBoxRepository";
import { TxClient } from "../../domain/repositories/UnitOfWork";

export class PrismaBoxRepository implements IBoxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateBoxDTO): Promise<Box> {
    return this.prisma.box.create({
      data: {
        userId: data.userId,
        name: data.name,
        icon: data.icon ?? null,
        targetAmount: data.targetAmount ?? null,
        priority: data.priority ?? 0,
        categoryId: data.categoryId ?? null,
      },
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<Box | null> {
    return this.prisma.box.findFirst({ where: { id, userId } });
  }

  async findByNameForUser(userId: string, name: string): Promise<Box | null> {
    return this.prisma.box.findFirst({
      where: {
        userId,
        isArchived: false,
        name: { equals: name, mode: "insensitive" },
      },
    });
  }

  async findByCategoryId(
    userId: string,
    categoryId: string,
  ): Promise<Box | null> {
    return this.prisma.box.findFirst({
      where: { userId, categoryId, isArchived: false },
    });
  }

  // Σ IN − Σ OUT over a set of boxes' non-deleted MONEY entries. Tracking
  // entries are excluded — they advance goal progress but hold no money.
  private async balanceMap(boxIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (boxIds.length === 0) return map;
    const groups = await this.prisma.boxEntry.groupBy({
      by: ["boxId", "direction"],
      where: { boxId: { in: boxIds }, isDeleted: false, isTracking: false },
      _sum: { amount: true },
    });
    for (const g of groups) {
      const signed =
        (g.direction === "IN" ? 1 : -1) * Number(g._sum.amount ?? 0);
      map.set(g.boxId, (map.get(g.boxId) ?? 0) + signed);
    }
    return map;
  }

  async listWithBalances(userId: string): Promise<BoxWithBalance[]> {
    const boxes = await this.prisma.box.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
    const balances = await this.balanceMap(boxes.map((b) => b.id));
    return boxes.map((b) => ({ ...b, balance: balances.get(b.id) ?? 0 }));
  }

  async balanceFor(boxId: string): Promise<number> {
    return (await this.balanceMap([boxId])).get(boxId) ?? 0;
  }

  async update(id: string, data: UpdateBoxDTO): Promise<void> {
    await this.prisma.box.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.targetAmount !== undefined && {
          targetAmount: data.targetAmount,
        }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.box.delete({ where: { id } });
  }

  async addEntry(data: CreateBoxEntryDTO, tx?: TxClient): Promise<BoxEntry> {
    return (tx ?? this.prisma).boxEntry.create({
      data: {
        boxId: data.boxId,
        userId: data.userId,
        amount: data.amount,
        direction: data.direction,
        source: data.source ?? "MANUAL",
        note: data.note ?? null,
        rawText: data.rawText ?? null,
      },
    });
  }

  async listEntries(boxId: string, userId: string): Promise<BoxEntry[]> {
    return this.prisma.boxEntry.findMany({
      where: { boxId, userId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  async softDeleteEntry(id: string, userId: string): Promise<void> {
    await this.prisma.boxEntry.updateMany({
      where: { id, userId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async goalBoxesPendingAlert(userId: string): Promise<BoxWithBalance[]> {
    const boxes = await this.prisma.box.findMany({
      where: {
        userId,
        isArchived: false,
        targetReachedAt: null,
        targetAmount: { not: null },
      },
    });
    const balances = await this.balanceMap(boxes.map((b) => b.id));
    return boxes
      .map((b) => ({ ...b, balance: balances.get(b.id) ?? 0 }))
      .filter((b) => b.balance >= Number(b.targetAmount ?? 0));
  }

  async markTargetReached(id: string, tx?: TxClient): Promise<boolean> {
    // Idempotent: only the first caller (targetReachedAt still null) stamps it.
    const result = await (tx ?? this.prisma).box.updateMany({
      where: { id, targetReachedAt: null },
      data: { targetReachedAt: new Date() },
    });
    return result.count > 0;
  }
}
