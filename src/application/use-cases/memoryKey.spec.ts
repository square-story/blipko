import { describe, it, expect } from "vitest";
import { phraseMemoryKey } from "./memoryKey";

describe("phraseMemoryKey", () => {
  it("strips the amount and keeps the phrase", () => {
    expect(phraseMemoryKey("chai 30")).toBe("chai");
    expect(phraseMemoryKey("auto to office 80")).toBe("auto to office");
  });

  it("folds case and whitespace so one lesson is one row", () => {
    const key = phraseMemoryKey("chai 30");
    expect(phraseMemoryKey("Chai 45")).toBe(key);
    expect(phraseMemoryKey("  chai   30  ")).toBe(key);
  });

  // The regression that matters most. categoryMatchKey strips [^a-z0-9], which
  // would reduce every one of these to "" — and under @@unique([userId,
  // phraseKey]) they would all collide on one row and rewrite each other.
  it("keeps non-Latin script distinct instead of collapsing it to empty", () => {
    const mal = phraseMemoryKey("പെട്രോൾ 500");
    const hin = phraseMemoryKey("चाय 30");
    const lat = phraseMemoryKey("chai 30");

    expect(mal).toBeTruthy();
    expect(hin).toBeTruthy();
    expect(new Set([mal, hin, lat]).size).toBe(3);
  });

  it("returns null when there is no phrase left after the amount", () => {
    expect(phraseMemoryKey("30")).toBeNull();
    expect(phraseMemoryKey("₹1,200")).toBeNull();
    expect(phraseMemoryKey("")).toBeNull();
    expect(phraseMemoryKey("   ")).toBeNull();
    expect(phraseMemoryKey(null)).toBeNull();
    expect(phraseMemoryKey(undefined)).toBeNull();
  });

  it("rejects a whole sentence rather than storing junk", () => {
    expect(phraseMemoryKey("x".repeat(61))).toBeNull();
    expect(phraseMemoryKey("x".repeat(60))).toBe("x".repeat(60));
  });
});
