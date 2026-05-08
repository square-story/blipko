import { RecurringCharge } from "@prisma/client";

export interface CreateRecurringChargeDTO {
  userId: string;
  contactId?: string;
  walletId?: string;
  amount: number;
  amountMin?: number;
  amountMax?: number;
  direction: "INCOME" | "EXPENSE";
  description: string;
  period: "MONTHLY" | "QUARTERLY";
  dayOfMonth: number;
  notifyDaysBefore?: number;
}

export interface IRecurringChargeRepository {
  create(data: CreateRecurringChargeDTO): Promise<RecurringCharge>;
  findByUserId(userId: string): Promise<RecurringCharge[]>;
  findDueForNotification(
    beforeDate: Date,
  ): Promise<(RecurringCharge & { user: { telegramId: string | null } })[]>;
  markNotified(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
}
