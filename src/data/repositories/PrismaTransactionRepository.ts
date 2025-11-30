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
      where: { ...filter, isDeleted: false },
      orderBy: { date: "desc" },
      take: 3,
    });
  }

  async findByUser(userId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  async findByContact(contactId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { contactId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  async deleteLastTransaction(userId: string): Promise<Transaction | null> {
    const lastTransaction = await this.prisma.transaction.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { date: "desc" },
    });

    if (!lastTransaction) {
      return null;
    }

    return this.prisma.transaction.update({
      where: { id: lastTransaction.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    });
  }
  async findByConfirmationId(messageId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { confirmationMessageId: messageId },
    });
  }

  async updateConfirmationMessageId(
    transactionId: string,
    messageId: string,
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { confirmationMessageId: messageId },
    });
  }

  async delete(transactionId: string): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async update(
    transactionId: string,
    data: Partial<CreateTransactionDTO>,
  ): Promise<void> {
    const updateData: any = {};
    if (data.category) updateData.category = data.category;
    if (data.description) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
    });
  }
}
