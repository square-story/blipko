import { PrismaClient } from "@prisma/client";
import {
  CategoryMemoryHit,
  ICategoryMemoryRepository,
} from "../../domain/repositories/ICategoryMemoryRepository";

export class PrismaCategoryMemoryRepository implements ICategoryMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findForPhrase(
    userId: string,
    phraseKey: string,
  ): Promise<CategoryMemoryHit | null> {
    const row = await this.prisma.categoryMemory.findUnique({
      where: { userId_phraseKey: { userId, phraseKey } },
      // box comes along so the guard below costs no extra round trip.
      include: { category: { include: { box: true } } },
    });
    if (!row) return null;

    const category = row.category;
    // See ICategoryMemoryRepository for why these two are refusals rather than
    // guards at the call sites: a group lands the spend uncategorized, and a
    // box-linked category produces a diversion the user can never correct.
    if (category.isGroup || category.box) return null;

    return {
      categoryId: category.id,
      categoryName: category.name,
      bucket: category.bucket,
    };
  }

  async remember(
    userId: string,
    phraseKey: string,
    phrase: string,
    categoryId: string,
  ): Promise<void> {
    await this.prisma.categoryMemory.upsert({
      where: { userId_phraseKey: { userId, phraseKey } },
      update: { categoryId, hits: { increment: 1 }, lastUsedAt: new Date() },
      create: { userId, phraseKey, phrase, categoryId },
    });
  }
}
