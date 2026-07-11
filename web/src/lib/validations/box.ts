import { z } from "zod";

// A persistent savings goal / fund envelope. Isolated from the 50/30/20 budget.
export const boxSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  icon: z.string().trim().max(32).optional(),
  // Optional goal amount; omitted / null = an open-ended fund.
  targetAmount: z
    .number()
    .positive("Must be positive")
    .max(1_000_000_000)
    .optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  // Optional leaf category to link — its transactions divert into this box.
  categoryId: z.string().trim().max(50).optional(),
});

export type BoxInput = z.infer<typeof boxSchema>;

// A single contribution to / withdrawal from a box.
export const boxEntrySchema = z.object({
  amount: z.number().positive("Must be positive").max(1_000_000_000),
  note: z.string().trim().max(100).optional(),
});

export type BoxEntryInput = z.infer<typeof boxEntrySchema>;
