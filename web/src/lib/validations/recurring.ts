import { z } from "zod";

// A repeating income/expense the bot auto-logs each month on dayOfMonth.
export const recurringRuleSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE", "BOX"]),
  amount: z.number().positive("Must be positive").max(1_000_000_000),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(28, "Use 1–28 to avoid month-end issues"),
  bucket: z.enum(["NEEDS", "WANTS", "SAVINGS"]).optional(),
  categoryId: z.string().trim().max(50).optional(),
  boxId: z.string().trim().max(50).optional(),
  note: z.string().trim().max(100).optional(),
});

export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;
