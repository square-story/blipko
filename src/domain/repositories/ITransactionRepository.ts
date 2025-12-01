import { Transaction, Intent } from "@prisma/client";

export interface CreateTransactionDTO {
  amount: number;
  intent: Intent;
  description?: string | undefined;
  category?: string | undefined;
  userId: string;
  contactId?: string | undefined;
}

export interface ITransactionRepository {
  create(data: CreateTransactionDTO): Promise<Transaction>;
  findByUser(userId: string): Promise<Transaction[]>;
  findByContact(contactId: string): Promise<Transaction[]>;
  findById(transactionId: string): Promise<Transaction | null>;
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
}
