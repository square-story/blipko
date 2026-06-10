import { BudgetConfig, PrismaClient } from "@prisma/client";
import {
  CreateBudgetConfigDTO,
  IBudgetConfigRepository,
} from "../../domain/repositories/IBudgetConfigRepository";

export class PrismaBudgetConfigRepository implements IBudgetConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateBudgetConfigDTO): Promise<BudgetConfig> {
    return this.prisma.budgetConfig.create({
      data: {
        userId: data.userId,
        ...(data.needsPct !== undefined && { needsPct: data.needsPct }),
        ...(data.wantsPct !== undefined && { wantsPct: data.wantsPct }),
        ...(data.savingsPct !== undefined && { savingsPct: data.savingsPct }),
      },
    });
  }

  async findByUserId(userId: string): Promise<BudgetConfig | null> {
    return this.prisma.budgetConfig.findUnique({ where: { userId } });
  }
}
