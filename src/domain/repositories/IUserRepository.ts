import { User } from "@prisma/client";

export interface CreateUserDTO {
  telegramId?: string;
  email?: string;
  name?: string;
}

export interface UpdateUserDTO {
  telegramId?: string;
  name?: string;
  monthlyIncome?: number;
  hasOnboarded?: boolean;
}

export interface IUserRepository {
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  linkTelegramByToken(token: string, telegramId: string): Promise<User | null>;
}
