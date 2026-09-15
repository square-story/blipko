import { PendingAction, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import {
  CreatePendingActionDTO,
  IPendingActionRepository,
} from "../../domain/repositories/IPendingActionRepository";

export class PrismaPendingActionRepository implements IPendingActionRepository {
  async create(data: CreatePendingActionDTO): Promise<PendingAction> {
    return prisma.pendingAction.create({
      data: {
        userId: data.userId,
        kind: data.kind,
        payload: data.payload as Prisma.InputJsonValue,
        summary: data.summary,
        expiresAt: new Date(Date.now() + data.ttlMinutes * 60_000),
      },
    });
  }

  async findLiveForUser(
    id: string,
    userId: string,
  ): Promise<PendingAction | null> {
    return prisma.pendingAction.findFirst({
      where: {
        id,
        userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findLiveByKindForUser(
    userId: string,
    kind: string,
  ): Promise<PendingAction | null> {
    return prisma.pendingAction.findFirst({
      where: {
        userId,
        kind,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async consume(id: string, userId: string): Promise<boolean> {
    // Conditional update: `consumedAt: null` in the WHERE makes this the lock.
    // Two rapid taps both find a live row, but only one updateMany matches.
    const { count } = await prisma.pendingAction.updateMany({
      where: { id, userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    return count === 1;
  }
}
