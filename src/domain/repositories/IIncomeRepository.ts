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

// Partial edit of an existing income (amount/source/note).
export interface UpdateIncomeDTO {
  amount?: number | undefined;
  source?: string | null | undefined;
  note?: string | null | undefined;
}

export interface IIncomeRepository {
  create(data: CreateIncomeDTO, tx?: TxClient): Promise<Income>;
  // Sum of non-deleted income within [monthStart, monthEnd).
  sumForMonth(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number>;
  findById(id: string): Promise<Income | null>;
  findLastByUserId(userId: string): Promise<Income | null>;
  // Resolve the income behind a confirmation message the user replied to.
  findByConfirmationMessageId(
    messageId: string,
    userId: string,
  ): Promise<Income | null>;
  updateConfirmationMessageId(id: string, messageId: string): Promise<void>;
  // Partial edit of a single income (amount/source/note).
  update(id: string, data: UpdateIncomeDTO): Promise<void>;
  // All non-deleted income sharing a batchId (transactions from one message).
  findByBatchId(batchId: string, userId: string): Promise<Income[]>;
  // Soft-delete every income in a batch.
  softDeleteByBatchId(batchId: string, userId: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  // Undo a soft-delete (single + whole batch).
  restore(id: string): Promise<void>;
  restoreByBatchId(batchId: string, userId: string): Promise<void>;
}
