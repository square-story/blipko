import { Bucket, NudgeKind, Prisma, PrismaClient } from "@prisma/client";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";

export class PrismaNudgeRepository implements INudgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordSentIfNew(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
  ): Promise<boolean> {
    try {
      await this.prisma.budgetNudge.create({
        data: { userId, bucket, kind, periodKey },
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
}
