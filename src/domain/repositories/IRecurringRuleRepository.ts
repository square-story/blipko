import { Bucket, RecurringKind, RecurringRule } from "@prisma/client";
import { TxClient } from "./UnitOfWork";

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
  // All active rules (the per-user-timezone "due this month" check is done in
  // PostRecurringCharges, since monthKey depends on the owner's timezone).
  findAllActive(): Promise<RecurringRule[]>;
  markPosted(id: string, monthKey: string, tx?: TxClient): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
