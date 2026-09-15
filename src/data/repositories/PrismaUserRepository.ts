import { Prisma, PrismaClient, User } from "@prisma/client";
import {
  IUserRepository,
  CreateUserDTO,
  UpdateUserDTO,
} from "../../domain/repositories/IUserRepository";
import { mergeTelegramUser } from "./mergeTelegramUser";

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
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.hasOnboarded !== undefined && {
          hasOnboarded: data.hasOnboarded,
        }),
        ...(data.onboardingStep !== undefined && {
          onboardingStep: data.onboardingStep,
        }),
        ...(data.carryDecidedKey !== undefined && {
          carryDecidedKey: data.carryDecidedKey,
        }),
        ...(data.onboardingDraft !== undefined && {
          onboardingDraft:
            data.onboardingDraft === null
              ? Prisma.JsonNull
              : data.onboardingDraft,
        }),
        ...(data.notificationDosage !== undefined && {
          notificationDosage: data.notificationDosage,
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

  async findOnboardedWithTelegram(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        hasOnboarded: true,
        telegramId: { not: null },
      },
    });
  }

  async claimCarryCycle(userId: string, cycleKey: string): Promise<boolean> {
    // `not: cycleKey` alone would skip rows where the column is still NULL —
    // SQL's <> is not true for NULL — which is every user who has never been
    // asked. The explicit OR puts them back in.
    const { count } = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ carryDecidedKey: null }, { carryDecidedKey: { not: cycleKey } }],
      },
      data: { carryDecidedKey: cycleKey },
    });
    return count === 1;
  }

  async linkTelegramByToken(
    token: string,
    telegramId: string,
  ): Promise<User | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const linkToken = await tx.telegramLinkToken.findUnique({
          where: { token },
        });
        if (!linkToken || linkToken.expiresAt < new Date()) return null;
        const webUserId = linkToken.userId;

        // If this Telegram id already belongs to a separate (Telegram-only) user
        // — e.g. the user messaged the bot before linking — merge it into the web
        // account instead of leaving two split rows. Otherwise just assign it.
        const botUser = await tx.user.findFirst({
          where: { telegramId, id: { not: webUserId } },
        });
        if (botUser) {
          await mergeTelegramUser(tx, botUser.id, webUserId, telegramId);
        } else {
          await tx.user.update({
            where: { id: webUserId },
            data: { telegramId },
          });
        }

        await tx.telegramLinkToken.delete({ where: { token } });
        return tx.user.findUnique({ where: { id: webUserId } });
      },
      { timeout: 30000 },
    ); // merge does several sequential writes; raise from the 5s default
  }
}
