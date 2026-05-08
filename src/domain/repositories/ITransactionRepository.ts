import { Transaction, Intent } from "@prisma/client";

export interface CreateTransactionDTO {
  amount: number;
  intent: Intent;
  description?: string | undefined;
  category?: string | undefined;
  userId: string;
  contactId?: string | undefined;
  walletId?: string | undefined;
}

export interface MonthlyAnalytics {
  month: string; // "YYYY-MM"
  totalIn: number;
  totalOut: number;
  categoryBreakdown: Record<string, number>;
}

export interface ITransactionRepository {
  create(data: CreateTransactionDTO): Promise<Transaction>;
  findByUser(userId: string): Promise<Transaction[]>;
  findByContact(contactId: string): Promise<Transaction[]>;
  findById(transactionId: string): Promise<Transaction | null>;
  findLastByUserId(userId: string): Promise<Transaction | null>;
  deleteLastTransaction(userId: string): Promise<Transaction | null>;
  findThreeTransactions(filter: {
    userId?: string;
    contactId?: string;
  }): Promise<Transaction[]>;
  findByConfirmationId(messageId: string): Promise<Transaction | null>;
  updateConfirmationMessageId(
    transactionId: string,
    messageId: string,
  ): Promise<void>;
  delete(transactionId: string): Promise<void>;
  update(
    transactionId: string,
    data: Partial<CreateTransactionDTO>,
  ): Promise<void>;
  getDailySummary(
    userId: string,
    date: Date,
  ): Promise<{
    transactions: Transaction[];
    totalSpend: number;
    categoryBreakdown: Record<string, number>;
  }>;
  findUnpaidContacts(userId: string): Promise<
    {
      contactId: string;
      contactName: string;
      balance: number;
    }[]
  >;
  getMonthlyAnalytics(
    userId: string,
    months: number,
  ): Promise<MonthlyAnalytics[]>;
}
