import { describe, it, expect } from "vitest";
import { ParsedDataSchema } from "./ParsedData";

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
});
