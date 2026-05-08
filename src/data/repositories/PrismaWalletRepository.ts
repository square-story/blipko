import { PrismaClient, Wallet } from "@prisma/client";
import {
  IWalletRepository,
  CreateWalletDTO,
} from "../../domain/repositories/IWalletRepository";

export class PrismaWalletRepository implements IWalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateWalletDTO): Promise<Wallet> {
    return this.prisma.wallet.create({
      data: {
        name: data.name,
        emoji: data.emoji ?? "💰",
        type: data.type ?? "PERSONAL",
        isDefault: data.isDefault ?? false,
        userId: data.userId,
      },
    });
  }

  async findByUserId(userId: string): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findDefaultByUser(userId: string): Promise<Wallet | null> {
    return this.prisma.wallet.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async findByName(userId: string, name: string): Promise<Wallet | null> {
    return this.prisma.wallet.findFirst({
      where: {
        userId,
        name: { equals: name, mode: "insensitive" },
      },
    });
  }

  async findById(id: string): Promise<Wallet | null> {
    return this.prisma.wallet.findUnique({ where: { id } });
  }

  async setDefault(walletId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.wallet.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.wallet.update({
        where: { id: walletId },
        data: { isDefault: true },
      }),
    ]);
  }

  async delete(walletId: string): Promise<void> {
    await this.prisma.wallet.delete({ where: { id: walletId } });
  }
}
