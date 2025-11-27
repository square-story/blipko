import { Transaction, Intent } from '@prisma/client';

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
}
