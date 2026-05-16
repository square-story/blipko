import { DueEntry } from "@prisma/client";

export interface CreateDueEntryDTO {
  chargeId: string;
  contactId?: string;
  walletId?: string;
  dueDate: Date;
  amount: number;
}

export interface IDueEntryRepository {
  create(data: CreateDueEntryDTO): Promise<DueEntry>;
  createManySkipDuplicates(entries: CreateDueEntryDTO[]): Promise<number>;
  findPendingForCharge(chargeId: string): Promise<DueEntry[]>;
  findUnnotified(upToDate: Date): Promise<
    (DueEntry & {
      charge: RecurringChargeWithUser;
    })[]
  >;
  markNotified(id: string): Promise<void>;
  markPaid(id: string, paidAmount: number): Promise<void>;
  snooze(id: string, days: number): Promise<void>;
  findById(id: string): Promise<(DueEntry & { charge: { userId: string } }) | null>;
  findUpcomingByUser(
    userId: string,
    limit: number,
  ): Promise<(DueEntry & { charge: { description: string; period: string } })[]>;
}

interface RecurringChargeWithUser {
  id: string;
  description: string;
  amount: import("@prisma/client").Prisma.Decimal;
  userId: string;
  user: { telegramId: string | null; name: string | null };
}
