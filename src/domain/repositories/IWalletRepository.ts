import { Wallet } from "@prisma/client";

export interface CreateWalletDTO {
  name: string;
  emoji?: string;
  type?: "PERSONAL" | "BUSINESS" | "SAVINGS" | "CUSTOM";
  isDefault?: boolean;
  userId: string;
}

export interface IWalletRepository {
  create(data: CreateWalletDTO): Promise<Wallet>;
  findByUserId(userId: string): Promise<Wallet[]>;
  findDefaultByUser(userId: string): Promise<Wallet | null>;
  findByName(userId: string, name: string): Promise<Wallet | null>;
  findById(id: string): Promise<Wallet | null>;
  setDefault(walletId: string, userId: string): Promise<void>;
  delete(walletId: string): Promise<void>;
}
