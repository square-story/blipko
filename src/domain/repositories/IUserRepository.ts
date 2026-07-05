import { NotificationDosage, Prisma, User } from "@prisma/client";

export interface CreateUserDTO {
  telegramId?: string;
  email?: string;
  name?: string;
}

export interface UpdateUserDTO {
  telegramId?: string;
  name?: string;
  monthlyIncome?: number;
  timezone?: string;
  hasOnboarded?: boolean;
  onboardingStep?: string | null;
  onboardingDraft?: Prisma.InputJsonValue | null;
  notificationDosage?: NotificationDosage;
}

export interface IUserRepository {
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  // Onboarded users reachable on Telegram (nudge/report/recurring audience).
  // No income filter — a budget can come from logged income, and dosage opt-in
  // shouldn't be silently dropped; each job skips users with no effective budget.
  findOnboardedWithTelegram(): Promise<User[]>;
  linkTelegramByToken(token: string, telegramId: string): Promise<User | null>;
}
