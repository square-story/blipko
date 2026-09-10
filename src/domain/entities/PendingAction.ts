import { z } from "zod";
import { BUCKETS } from "./ParsedData";

// Payloads for writes the assistant proposes. Validated with Zod on the way OUT
// of the database, not just on the way in: the row is written from model-shaped
// input, and between proposal and confirmation it is untrusted JSON.

export const EditExpensePayload = z.object({
  expenseId: z.string().min(1),
  amount: z.number().positive().max(10_000_000).optional(),
  bucket: z.enum(BUCKETS).optional(),
  categoryName: z.string().min(1).max(50).optional(),
  note: z.string().max(200).optional(),
});

export const DeleteExpensePayload = z.object({
  expenseId: z.string().min(1),
});

export const SetRecurringPayload = z.object({
  kind: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive().max(1_000_000_000),
  dayOfMonth: z.number().int().min(1).max(28),
  // bucket + categoryName apply to an EXPENSE rule (Category, which requires a
  // bucket); incomeCategoryName applies to an INCOME rule (IncomeCategory,
  // which has none). `kind` decides which is read.
  bucket: z.enum(BUCKETS).optional(),
  categoryName: z.string().min(1).max(50).optional(),
  incomeCategoryName: z.string().min(1).max(50).optional(),
  note: z.string().max(200).optional(),
});

export const BoxMovePayload = z.object({
  boxName: z.string().min(1).max(60),
  amount: z.number().positive().max(1_000_000_000),
  direction: z.enum(["IN", "OUT"]),
  note: z.string().max(200).optional(),
});

export const PENDING_ACTION_SCHEMAS = {
  EDIT_EXPENSE: EditExpensePayload,
  DELETE_EXPENSE: DeleteExpensePayload,
  SET_RECURRING: SetRecurringPayload,
  BOX_MOVE: BoxMovePayload,
} as const;

export type PendingActionKind = keyof typeof PENDING_ACTION_SCHEMAS;

export const PENDING_ACTION_KINDS = Object.keys(
  PENDING_ACTION_SCHEMAS,
) as PendingActionKind[];

export function isPendingActionKind(v: string): v is PendingActionKind {
  return v in PENDING_ACTION_SCHEMAS;
}

// Parse a stored row's payload for its kind. Returns null rather than throwing
// so a corrupt row degrades to "that expired" instead of a 500.
export function parsePendingPayload(
  kind: string,
  payload: unknown,
): { kind: PendingActionKind; data: unknown } | null {
  if (!isPendingActionKind(kind)) return null;
  const result = PENDING_ACTION_SCHEMAS[kind].safeParse(payload);
  return result.success ? { kind, data: result.data } : null;
}
