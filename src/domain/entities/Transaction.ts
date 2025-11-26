export type TransactionType = 'CREDIT' | 'DEBIT';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  description?: string | null;
  customerId: string;
  createdAt: Date;
}

