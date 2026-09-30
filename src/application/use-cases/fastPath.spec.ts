import { describe, it, expect } from "vitest";
import { parsePhraseAmount } from "./fastPath";
import { phraseMemoryKey } from "./memoryKey";

describe("parsePhraseAmount", () => {
  it("reads a phrase and an amount in either order", () => {
    expect(parsePhraseAmount("chai 30")).toMatchObject({
      phrase: "chai",
      amount: 30,
    });
    expect(parsePhraseAmount("30 chai")).toMatchObject({
      phrase: "chai",
      amount: 30,
    });
  });

  it("handles the ways an amount is actually typed", () => {
    expect(parsePhraseAmount("chai ₹30")).toMatchObject({ amount: 30 });
    expect(parsePhraseAmount("petrol ₹ 1,200")).toMatchObject({
      phrase: "petrol",
      amount: 1200,
    });
    // The currency marker must not survive into the phrase — "auto rs" would
    // key a lookup the user never taught.
    expect(parsePhraseAmount("auto rs. 1,200")).toMatchObject({
      phrase: "auto",
      amount: 1200,
    });
  });

  it("works on non-Latin script, like the rest of this bot", () => {
    expect(parsePhraseAmount("ചായ 30")).toMatchObject({
      phrase: "ചായ",
      amount: 30,
    });
  });

  // The one that prevents silent data loss: a batch must reach the parser.
  it("refuses anything with a second number", () => {
    expect(parsePhraseAmount("chai 30, auto 80")).toBeNull();
    expect(parsePhraseAmount("chai 30 auto 80")).toBeNull();
  });

  it("refuses shapes that are not a simple spend", () => {
    // A bare number belongs to the carry flow, not here.
    expect(parsePhraseAmount("30")).toBeNull();
    expect(parsePhraseAmount("500")).toBeNull();
    // No amount at all.
    expect(parsePhraseAmount("how much did i spend")).toBeNull();
    expect(parsePhraseAmount("chai")).toBeNull();
    // Over the word cap — questions and sentences go to the parser.
    expect(parsePhraseAmount("how much did i spend on chai 30")).toBeNull();
    expect(parsePhraseAmount("")).toBeNull();
  });

  // If these two ever disagree, a correction can be written under one key and
  // looked up under another, and the fast path silently never fires.
  it("produces the key rememberCategoryChoice writes", () => {
    expect(parsePhraseAmount("chai 30")?.phraseKey).toBe(
      phraseMemoryKey("chai"),
    );
    expect(parsePhraseAmount("Chai 45")?.phraseKey).toBe(
      parsePhraseAmount("chai 30")?.phraseKey,
    );
  });
});
