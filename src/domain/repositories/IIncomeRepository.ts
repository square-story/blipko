import { Income } from "@prisma/client";

export interface CreateIncomeDTO {
  userId: string;
  amount: number;
  rawText: string;
  confidence: number;
  source?: string | undefined;
  note?: string | undefined;
}

export interface IIncomeRepository {
  create(data: CreateIncomeDTO): Promise<Income>;
  // Sum of non-deleted income within [monthStart, monthEnd).
  sumForMonth(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number>;
  findLastByUserId(userId: string): Promise<Income | null>;
  softDelete(id: string): Promise<void>;
}
