import { IncomeCategory, PrismaClient } from "@prisma/client";
import { IIncomeCategoryRepository } from "../../domain/repositories/IIncomeCategoryRepository";

export class PrismaIncomeCategoryRepository implements IIncomeCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllForUser(userId: string): Promise<IncomeCategory[]> {
    return this.prisma.incomeCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    });
  }
}
