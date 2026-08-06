import { describe, it, expect } from "vitest";
import { openaiBudgetSchema, stripNulls } from "./openaiBudgetSchema";
import { ParsedBatchSchema } from "../../domain/entities/ParsedData";

// The schema object is untyped JSON Schema; these helpers keep the assertions
// readable without sprinkling casts through every test.
const envelope = openaiBudgetSchema as {
  required: string[];
  additionalProperties: boolean;
  properties: { transactions: { items: Record<string, unknown> } };
};
const transaction = envelope.properties.transactions.items as {
  properties: Record<string, { type: unknown; enum?: unknown[] }>;
  required: string[];
  additionalProperties: boolean;
};

describe("openaiBudgetSchema (OpenAI strict mode)", () => {
  it("requires the transactions envelope", () => {
    expect(envelope.required).toEqual(["transactions"]);
    expect(envelope.additionalProperties).toBe(false);
  });

  it("lists every transaction property in required", () => {
    const properties = Object.keys(transaction.properties).sort();
    expect([...transaction.required].sort()).toEqual(properties);
  });

  it("forbids additional properties on a transaction", () => {
    expect(transaction.additionalProperties).toBe(false);
  });

  it("includes null in every nullable enum", () => {
    for (const [name, prop] of Object.entries(transaction.properties)) {
      const nullable = Array.isArray(prop.type) && prop.type.includes("null");
      if (!nullable || !prop.enum) continue;
      expect(prop.enum, `${name} enum must allow null`).toContain(null);
    }
  });

  it("keeps intent and confidence non-nullable", () => {
    expect(transaction.properties["intent"]?.type).toBe("string");
    expect(transaction.properties["confidence"]?.type).toBe("number");
  });
});

describe("stripNulls", () => {
  it("turns a fully null-padded wire object into a valid ParsedBatch", () => {
    // What strict mode actually returns: every key present, nulls for N/A.
    const wire = {
      transactions: [
        {
          intent: "STATUS",
          amount: null,
          currency: null,
          category: null,
          bucket: null,
          note: null,
          dayOfMonth: null,
          recurringKind: null,
          boxName: null,
          boxDirection: null,
          confidence: 0.9,
          conversational_response: null,
        },
      ],
    };

    const result = ParsedBatchSchema.safeParse(stripNulls(wire));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactions[0]?.intent).toBe("STATUS");
      expect(result.data.transactions[0]?.amount).toBeUndefined();
      expect(result.data.transactions[0]?.bucket).toBeUndefined();
    }
  });

  it("leaves non-null values untouched", () => {
    expect(
      stripNulls({ intent: "EXPENSE", amount: 30, note: null, zero: 0 }),
    ).toEqual({ intent: "EXPENSE", amount: 30, zero: 0 });
  });
});
