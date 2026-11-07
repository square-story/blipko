import { PrismaClient } from "@prisma/client";
import { IClarityScoreRepository } from "../../domain/repositories/IClarityScoreRepository";

export class PrismaClarityScoreRepository implements IClarityScoreRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(userId: string, cycleKey: string, score: number): Promise<void> {
    await this.prisma.clarityScore.upsert({
      where: { userId_cycleKey: { userId, cycleKey } },
      create: { userId, cycleKey, score },
      update: { score },
    });
  }
}
