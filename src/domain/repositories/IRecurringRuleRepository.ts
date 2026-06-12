import { Bucket, RecurringKind, RecurringRule } from "@prisma/client";

export interface CreateRecurringRuleDTO {
  userId: string;
  kind: RecurringKind;
  amount: number;
  dayOfMonth: number;
  bucket?: Bucket | undefined;
  categoryId?: string | undefined;
  note?: string | undefined;
}

export interface IRecurringRuleRepository {
  create(data: CreateRecurringRuleDTO): Promise<RecurringRule>;
  findByUserId(userId: string): Promise<RecurringRule[]>;
  findById(id: string): Promise<RecurringRule | null>;
  // Active rules not yet posted for the given "YYYY-MM" key.
  findActiveUnpostedForMonth(monthKey: string): Promise<RecurringRule[]>;
  markPosted(id: string, monthKey: string): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
