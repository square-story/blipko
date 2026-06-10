import { Bucket, Expense, ExpenseSource } from "@prisma/client";

export interface CreateExpenseDTO {
  userId: string;
  amount: number;
  bucket: Bucket;
  note?: string | undefined;
  rawText: string;
  confidence: number;
  source?: ExpenseSource | undefined;
  categoryId?: string | undefined;
  parseLogId?: string | undefined;
}

export interface IExpenseRepository {
  create(data: CreateExpenseDTO): Promise<Expense>;
  findById(id: string): Promise<Expense | null>;
  updateConfirmationMessageId(
    expenseId: string,
    messageId: string,
  ): Promise<void>;
  // Sum of non-deleted expense amounts for a bucket within [monthStart, monthEnd).
  sumByBucketForMonth(
    userId: string,
    bucket: Bucket,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number>;
  softDelete(id: string): Promise<void>;
}
