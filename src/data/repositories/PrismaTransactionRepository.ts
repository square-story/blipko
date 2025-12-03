import { PrismaClient, Transaction } from "@prisma/client";
import {
  ITransactionRepository,
  CreateTransactionDTO,
} from "../../domain/repositories/ITransactionRepository";

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateTransactionDTO): Promise<Transaction> {
    const transaction = await this.prisma.transaction.create({
      data: {
        amount: data.amount,
        intent: data.intent,
        description: data.description ?? null,
        userId: data.userId,
        category: data.category ?? "General",
        contactId: data.contactId ?? null,
      },
    });

    if (data.contactId) {
      await this.updateContactBalance(data.contactId);
    }

    return transaction;
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

  async findById(transactionId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  async findLastByUserId(userId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { userId, isDeleted: false },
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

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: lastTransaction.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    });

    if (updatedTransaction.contactId) {
      await this.updateContactBalance(updatedTransaction.contactId);
    }

    return updatedTransaction;
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
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) return;

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    if (transaction.contactId) {
      await this.updateContactBalance(transaction.contactId);
    }
  }

  async update(
    transactionId: string,
    data: Partial<CreateTransactionDTO>,
  ): Promise<void> {
    const updateData: any = {};
    if (data.category) updateData.category = data.category;
    if (data.description) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;

    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
    });

    if (transaction.contactId) {
      await this.updateContactBalance(transaction.contactId);
    }
  }

  async getDailySummary(
    userId: string,
    date: Date,
  ): Promise<{
    transactions: Transaction[];
    totalSpend: number;
    categoryBreakdown: Record<string, number>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isDeleted: false,
      },
      orderBy: { date: "desc" },
    });

    let totalSpend = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const tx of transactions) {
      if (tx.intent === "CREDIT") {
        const amount = Number(tx.amount);
        totalSpend += amount;

        const category = tx.category || "General";
        categoryBreakdown[category] =
          (categoryBreakdown[category] || 0) + amount;
      }
    }

    return {
      transactions,
      totalSpend,
      categoryBreakdown,
    };
  }

  private async updateContactBalance(contactId: string): Promise<void> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        contactId,
        isDeleted: false,
      },
    });

    let balance = 0;
    for (const tx of transactions) {
      if (tx.intent === "CREDIT") {
        balance += Number(tx.amount);
      } else if (tx.intent === "DEBIT") {
        balance -= Number(tx.amount);
      }
    }

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { currentBalance: balance },
    });
  }
}
