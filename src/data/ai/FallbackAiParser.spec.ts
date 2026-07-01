import { describe, it, expect, vi } from "vitest";
import { FallbackAiParser } from "./FallbackAiParser";
import { IAiParser } from "../../domain/services/IAiParser";

const ctx = { categories: [] };
const ok = {
  transactions: [{ intent: "EXPENSE" as const, amount: 30, confidence: 0.9 }],
};

function parser(impl: IAiParser["parseText"]): IAiParser {
  return { parseText: vi.fn(impl) };
}

describe("FallbackAiParser", () => {
  it("returns the primary result when it succeeds", async () => {
    const primary = parser(async () => ok);
    const secondary = parser(async () => {
      throw new Error("should not be called");
    });
    const fallback = new FallbackAiParser(primary, secondary);

    await expect(fallback.parseText("chai 30", ctx)).resolves.toEqual(ok);
    expect(secondary.parseText).not.toHaveBeenCalled();
  });

  it("falls back to the secondary when the primary throws (e.g. Zod failure)", async () => {
    const primary = parser(async () => {
      throw new Error("invalid JSON / schema");
    });
    const secondary = parser(async () => ok);
    const fallback = new FallbackAiParser(primary, secondary);

    await expect(fallback.parseText("chai 30", ctx)).resolves.toEqual(ok);
    expect(secondary.parseText).toHaveBeenCalled();
  });

  it("returns a safe low-confidence UNKNOWN when both parsers fail", async () => {
    const primary = parser(async () => {
      throw new Error("down");
    });
    const secondary = parser(async () => {
      throw new Error("down");
    });
    const fallback = new FallbackAiParser(primary, secondary);

    const result = await fallback.parseText("chai 30", ctx);
    expect(result.transactions[0].intent).toBe("UNKNOWN");
    expect(result.transactions[0].confidence).toBe(0);
  });
});
