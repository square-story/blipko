import { User } from "@prisma/client";

export interface CreateUserDTO {
  phoneNumber?: string;
  telegramId?: string;
  email?: string;
  name?: string;
}

export interface IUserRepository {
  create(data: CreateUserDTO): Promise<User>;
  update(
    id: string,
    data: { telegramId?: string; name?: string },
  ): Promise<User>;
  findByPhone(phoneNumber: string): Promise<User | null>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  linkTelegramByToken(token: string, telegramId: string): Promise<User | null>;
}
