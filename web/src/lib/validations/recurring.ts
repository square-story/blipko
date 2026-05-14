import { z } from "zod";

export const createRecurringChargeSchema = z.object({
  description: z.string().min(1, "Description is required").max(100),
  amount: z.number().positive("Must be positive"),
  direction: z.enum(["INCOME", "EXPENSE"]),
  period: z.enum(["MONTHLY", "QUARTERLY"]),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(28, "Use 1–28 to avoid month-end issues"),
  walletId: z.string().optional().nullable(),
  notifyDaysBefore: z.number().int().min(0).max(7),
});

export type CreateRecurringChargeSchema = z.infer<
  typeof createRecurringChargeSchema
>;
