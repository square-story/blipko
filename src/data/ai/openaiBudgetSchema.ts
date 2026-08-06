import { BUCKETS, PARSED_INTENTS } from "../../domain/entities/ParsedData";

// OpenAI structured-output schema — the counterpart to GeminiParser's
// `budgetSchema`. Field descriptions are kept identical between the two so both
// providers read the same contract.
//
// Strict mode has three hard rules: `additionalProperties: false` on every
// object, EVERY property listed in `required`, and optionality expressed as
// nullability (a nullable enum must carry `null` in its own enum list).
//
// Hand-written rather than derived with `zodResponseFormat(ParsedBatchSchema)`:
// that helper throws on any `.optional()` field that isn't also `.nullable()`,
// and ParsedDataSchema is optional-heavy. `stripNulls` below drops the nulls
// back off so the wire object lands on those `.optional()` fields.

const transactionSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [...PARSED_INTENTS],
      description:
        'EXPENSE if the user spent money. INCOME if they received money/declared salary. STATUS for a plain overall budget-health check ("status", "how much is left"). UNDO to remove the last entry. RECURRING to set up a repeating monthly income/expense ("every month", "monthly", "on the Nth"). QUERY when the user ASKS a data-backed question about their spending/income/budget ("how much did I spend on food?", "biggest expense?", "can I afford X?", trends/comparisons) — a question, never a statement that logs money. BOX to add money to / withdraw from a NAMED savings goal or fund ("add 5000 to New York", "take 2000 from house fund") — only with explicit box phrasing, never ordinary spending. UNKNOWN for social/non-financial messages.',
    },
    amount: {
      type: ["number", "null"],
      description: "The numeric amount. 0 if none mentioned.",
    },
    currency: {
      type: ["string", "null"],
      description: "Currency code, default INR.",
    },
    category: {
      type: ["string", "null"],
      description: "Best category — prefer one from the user's list.",
    },
    bucket: {
      type: ["string", "null"],
      enum: [...BUCKETS, null],
      description: "The 50/30/20 bucket this spend belongs to.",
    },
    note: {
      type: ["string", "null"],
      description: "Short free-text note (e.g. 'lunch', 'auto to office').",
    },
    dayOfMonth: {
      type: ["number", "null"],
      description: "RECURRING only: day of month (1-28) it repeats.",
    },
    recurringKind: {
      type: ["string", "null"],
      enum: ["INCOME", "EXPENSE", null],
      description:
        "RECURRING only: whether the repeating item is income or expense.",
    },
    boxName: {
      type: ["string", "null"],
      description:
        "BOX only: the savings goal / fund the money moves in/out of.",
    },
    boxDirection: {
      type: ["string", "null"],
      enum: ["IN", "OUT", null],
      description: "BOX only: IN to add money to the box, OUT to withdraw.",
    },
    confidence: {
      type: "number",
      description:
        "0..1 confidence in amount + category + bucket. Below 0.6 when ambiguous.",
    },
    conversational_response: {
      type: ["string", "null"],
      description: "Friendly reply, only for UNKNOWN/social messages.",
    },
  },
  // Strict mode: every property, no exceptions. Fields that don't apply are null.
  required: [
    "intent",
    "amount",
    "currency",
    "category",
    "bucket",
    "note",
    "dayOfMonth",
    "recurringKind",
    "boxName",
    "boxDirection",
    "confidence",
    "conversational_response",
  ],
  additionalProperties: false,
};

// The envelope: one message → one or more transactions.
export const openaiBudgetSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: transactionSchema,
      description:
        "One entry per transaction. A single spend is an array of one; only genuine multi-transaction dumps have more.",
    },
  },
  required: ["transactions"],
  additionalProperties: false,
};

// Strict mode forces the model to emit every key, so inapplicable fields arrive
// as null. ParsedDataSchema models those as `.optional()`, so drop the nulls
// before validating.
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === null) continue;
      out[key] = stripNulls(item);
    }
    return out;
  }
  return value;
}
