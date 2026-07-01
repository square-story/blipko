import { Income } from "@prisma/client";
import { TxClient } from "./UnitOfWork";

export interface CreateIncomeDTO {
  userId: string;
  amount: number;
  rawText: string;
  confidence: number;
  source?: string | undefined;
  note?: string | undefined;
  batchId?: string | undefined;
}

export interface IIncomeRepository {
  create(data: CreateIncomeDTO, tx?: TxClient): Promise<Income>;
  // Sum of non-deleted income within [monthStart, monthEnd).
  sumForMonth(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number>;
  findLastByUserId(userId: string): Promise<Income | null>;
  // All non-deleted income sharing a batchId (transactions from one message).
  findByBatchId(batchId: string, userId: string): Promise<Income[]>;
  // Soft-delete every income in a batch.
  softDeleteByBatchId(batchId: string, userId: string): Promise<void>;
  softDelete(id: string): Promise<void>;
}
