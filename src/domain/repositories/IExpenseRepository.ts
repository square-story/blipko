import { Bucket, Expense, ExpenseSource } from "@prisma/client";
import { TxClient } from "./UnitOfWork";

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
  batchId?: string | undefined;
}

export interface IExpenseRepository {
  create(data: CreateExpenseDTO, tx?: TxClient): Promise<Expense>;
  findById(id: string): Promise<Expense | null>;
  // Most recent non-deleted expense for the user (for word-based undo).
  findLastByUserId(userId: string): Promise<Expense | null>;
  // Resolve the expense behind a confirmation message the user replied to.
  findByConfirmationMessageId(
    messageId: string,
    userId: string,
  ): Promise<Expense | null>;
  updateConfirmationMessageId(
    expenseId: string,
    messageId: string,
  ): Promise<void>;
  // All non-deleted expenses sharing a batchId (transactions from one message).
  findByBatchId(batchId: string, userId: string): Promise<Expense[]>;
  // Soft-delete every expense in a batch.
  softDeleteByBatchId(batchId: string, userId: string): Promise<void>;
  // Sum of non-deleted expense amounts for a bucket within [monthStart, monthEnd).
  sumByBucketForMonth(
    userId: string,
    bucket: Bucket,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<number>;
  // Top spending categories in a bucket within [monthStart, monthEnd), desc by total.
  topCategoriesForMonth(
    userId: string,
    bucket: Bucket,
    monthStart: Date,
    monthEnd: Date,
    limit: number,
  ): Promise<Array<{ name: string; total: number }>>;
  // Top spending categories over an arbitrary [from, to) range, optionally
  // scoped to one bucket. Generalizes topCategoriesForMonth for Q&A.
  categoryTotals(
    userId: string,
    from: Date,
    to: Date,
    bucket: Bucket | null,
    limit: number,
  ): Promise<Array<{ name: string; total: number }>>;
  // Recent non-deleted expenses, newest first, with optional category-name and
  // date-range filters. For conversational Q&A ("last few spends on food").
  findRecent(
    userId: string,
    opts: RecentExpenseFilter,
  ): Promise<RecentExpenseRow[]>;
  softDelete(id: string): Promise<void>;
}

export interface RecentExpenseFilter {
  limit: number;
  categoryName?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface RecentExpenseRow {
  date: Date;
  amount: number;
  bucket: Bucket;
  categoryName: string;
  note: string | null;
}
