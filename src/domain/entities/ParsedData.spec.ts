import { describe, it, expect } from "vitest";
import { ParsedDataSchema, ParsedBatchSchema } from "./ParsedData";

describe("ParsedDataSchema", () => {
  it("accepts a valid expense parse", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "EXPENSE",
      amount: 220,
      category: "Food",
      bucket: "WANTS",
      note: "lunch",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a RECURRING parse with dayOfMonth + recurringKind", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "RECURRING",
      recurringKind: "EXPENSE",
      amount: 8000,
      dayOfMonth: 1,
      category: "Rent",
      bucket: "NEEDS",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown intent", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "PAID",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid bucket", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "EXPENSE",
      bucket: "FUN",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("requires confidence", () => {
    const result = ParsedDataSchema.safeParse({ intent: "EXPENSE" });
    expect(result.success).toBe(false);
  });

  it("normalizes a negative amount to its magnitude", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "EXPENSE",
      amount: -30,
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(30);
  });

  it("leaves a missing amount undefined (no NaN from abs)", () => {
    const result = ParsedDataSchema.safeParse({
      intent: "STATUS",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBeUndefined();
  });
});

describe("ParsedBatchSchema", () => {
  it("accepts multiple transactions", () => {
    const result = ParsedBatchSchema.safeParse({
      transactions: [
        { intent: "EXPENSE", amount: 30, confidence: 0.9 },
        { intent: "INCOME", amount: 50000, confidence: 0.9 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.transactions).toHaveLength(2);
  });

  it("rejects an empty transactions array", () => {
    const result = ParsedBatchSchema.safeParse({ transactions: [] });
    expect(result.success).toBe(false);
  });
});
