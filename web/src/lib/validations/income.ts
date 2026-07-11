import { z } from "zod";

// Fields the user can edit on an existing income entry from the dashboard.
// rawText and confidence are never touched.
export const incomeEditSchema = z.object({
  amount: z.number().positive("Must be positive").max(1_000_000_000),
  date: z.date(),
  source: z.string().trim().max(50).optional(),
  note: z.string().trim().max(100).optional(),
});

export type IncomeEditInput = z.infer<typeof incomeEditSchema>;
