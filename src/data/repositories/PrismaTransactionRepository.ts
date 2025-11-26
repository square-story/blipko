import { prisma } from '../prisma/client';
import {
  CreateTransactionDTO,
  ITransactionRepository,
} from '../../domain/repositories/ITransactionRepository';
import { Transaction } from '../../domain/entities/Transaction';

export class PrismaTransactionRepository implements ITransactionRepository {
  async create(data: CreateTransactionDTO): Promise<Transaction> {
    const record = await prisma.transaction.create({ data });

    return {
      id: record.id,
      amount: Number(record.amount),
      type: record.type,
      description: record.description,
      customerId: record.customerId,
      createdAt: record.createdAt,
    };
  }
}


