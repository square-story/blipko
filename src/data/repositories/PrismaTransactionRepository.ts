import { PrismaClient, Transaction } from '@prisma/client';
import { ITransactionRepository, CreateTransactionDTO } from '../../domain/repositories/ITransactionRepository';

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) { }

  async create(data: CreateTransactionDTO): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        amount: data.amount,
        intent: data.intent,
        description: data.description ?? null,
        userId: data.userId,
        contactId: data.contactId ?? null,
      },
    });
  }

  async findByUser(userId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }
}
