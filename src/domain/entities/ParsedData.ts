import { z } from "zod";

// Bucket mirrors the Prisma `Bucket` enum (kept as a literal here to avoid a
// Prisma import in the domain layer).
export const BUCKETS = ["NEEDS", "WANTS", "SAVINGS"] as const;
export type ParsedBucket = (typeof BUCKETS)[number];

export const PARSED_INTENTS = [
  "EXPENSE",
  "INCOME",
  "UNDO",
  "STATUS",
  "RECURRING",
  "QUERY",
  "UNKNOWN",
] as const;
export type ParsedIntent = (typeof PARSED_INTENTS)[number];

// Zod schema — parsers validate AI JSON against this. A failure cascades to the
// fallback parser (see FallbackAiParser).
export const ParsedDataSchema = z.object({
  intent: z.enum(PARSED_INTENTS),
  // Amounts are always positive magnitudes — direction comes from intent
  // (EXPENSE vs INCOME), never the sign. Normalize any minus a user typed.
  amount: z
    .number()
    .transform((v) => Math.abs(v))
    .optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  bucket: z.enum(BUCKETS).optional(),
  note: z.string().optional(),
  // For RECURRING: which day of the month it recurs, and income vs expense.
  dayOfMonth: z.number().optional(),
  recurringKind: z.enum(["INCOME", "EXPENSE"]).optional(),
  confidence: z.number().min(0).max(1),
  conversational_response: z.string().optional(),
});

export type ParsedData = z.infer<typeof ParsedDataSchema>;

// A single message can carry multiple transactions (a "journal dump"). The
// parser always returns this envelope; a normal single spend is a batch of one.
// An object envelope (not a bare array) keeps it portable across Gemini
// responseSchema and OpenAI json_object, which can't return a top-level array.
export const ParsedBatchSchema = z.object({
  transactions: z.array(ParsedDataSchema).min(1),
});

export type ParsedBatch = z.infer<typeof ParsedBatchSchema>;
