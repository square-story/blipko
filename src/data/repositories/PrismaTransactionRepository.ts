import { PrismaClient, Transaction } from "@prisma/client";
import {
  ITransactionRepository,
  CreateTransactionDTO,
} from "../../domain/repositories/ITransactionRepository";

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateTransactionDTO): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        amount: data.amount,
        intent: data.intent,
        description: data.description ?? null,
        userId: data.userId,
        category: data.category ?? "General",
        contactId: data.contactId ?? null,
      },
    });
  }

  findThreeTransactions(filter: {
    userId?: string;
    contactId?: string;
  }): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: filter,
      orderBy: { date: "desc" },
      take: 3,
    });
  }

  async findByUser(userId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
  }

  async findByContact(contactId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { contactId },
      orderBy: { date: "desc" },
    });
  }
}
