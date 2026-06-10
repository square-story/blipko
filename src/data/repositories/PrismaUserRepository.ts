import { PrismaClient, User } from "@prisma/client";
import {
  IUserRepository,
  CreateUserDTO,
  UpdateUserDTO,
} from "../../domain/repositories/IUserRepository";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserDTO): Promise<User> {
    return this.prisma.user.create({
      data: {
        telegramId: data.telegramId ?? null,
        email: data.email ?? null,
        name: data.name ?? null,
      },
    });
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.telegramId !== undefined && { telegramId: data.telegramId }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.monthlyIncome !== undefined && {
          monthlyIncome: data.monthlyIncome,
        }),
        ...(data.hasOnboarded !== undefined && {
          hasOnboarded: data.hasOnboarded,
        }),
      },
    });
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async linkTelegramByToken(
    token: string,
    telegramId: string,
  ): Promise<User | null> {
    return this.prisma.$transaction(async (tx) => {
      const linkToken = await tx.telegramLinkToken.findUnique({
        where: { token },
        include: { user: true },
      });
      if (!linkToken || linkToken.expiresAt < new Date()) return null;
      const user = await tx.user.update({
        where: { id: linkToken.userId },
        data: { telegramId },
      });
      await tx.telegramLinkToken.delete({ where: { token } });
      return user;
    });
  }
}
