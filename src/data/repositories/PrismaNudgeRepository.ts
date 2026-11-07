import { Bucket, NudgeKind, Prisma, PrismaClient } from "@prisma/client";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";

export class PrismaNudgeRepository implements INudgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordSentIfNew(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
    meta?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.prisma.budgetNudge.create({
        data: {
          userId,
          bucket,
          kind,
          periodKey,
          ...(meta ? { meta: meta as Prisma.InputJsonObject } : {}),
        },
      });
      return true;
    } catch (e) {
      // Unique violation → already sent this period; skip.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return false;
      }
      throw e;
    }
  }

  async findMeta(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
  ): Promise<unknown> {
    const row = await this.prisma.budgetNudge.findUnique({
      where: {
        userId_bucket_kind_periodKey: { userId, bucket, kind, periodKey },
      },
      select: { meta: true },
    });
    return row?.meta ?? null;
  }
}
