import { Transaction, TransactionType } from '../entities/Transaction';

export interface CreateTransactionDTO {
  amount: number;
  type: TransactionType;
  description?: string;
  customerId: string;
}

export interface ITransactionRepository {
  create(data: CreateTransactionDTO): Promise<Transaction>;
}

