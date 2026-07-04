import { z } from "zod";

// Fields the user can edit on an existing expense from the dashboard.
// Bucket is derived from the chosen category (not edited directly); source,
// rawText and confidence are never touched.
export const expenseEditSchema = z.object({
  amount: z.number().positive("Must be positive").max(1_000_000_000),
  date: z.date(),
  categoryId: z.string().trim().max(50).optional(),
  note: z.string().trim().max(100).optional(),
});

export type ExpenseEditInput = z.infer<typeof expenseEditSchema>;
