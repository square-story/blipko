import { BudgetConfig } from "@prisma/client";

export interface CreateBudgetConfigDTO {
  userId: string;
  needsPct?: number;
  wantsPct?: number;
  savingsPct?: number;
}

export interface IBudgetConfigRepository {
  create(data: CreateBudgetConfigDTO): Promise<BudgetConfig>;
  findByUserId(userId: string): Promise<BudgetConfig | null>;
}
