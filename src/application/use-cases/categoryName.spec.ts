import { describe, it, expect } from "vitest";
import { normalizeCategoryName } from "./categoryName";

describe("normalizeCategoryName", () => {
  it("passes a clean name through", () => {
    expect(normalizeCategoryName("Food")).toBe("Food");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCategoryName("  Food  ")).toBe("Food");
  });

  it("collapses internal whitespace runs", () => {
    expect(normalizeCategoryName("Eating   out\tdaily")).toBe(
      "Eating out daily",
    );
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(normalizeCategoryName("")).toBeUndefined();
    expect(normalizeCategoryName("   ")).toBeUndefined();
  });

  it("rejects undefined", () => {
    expect(normalizeCategoryName(undefined)).toBeUndefined();
  });

  it("accepts exactly 50 characters", () => {
    const name = "x".repeat(50);
    expect(normalizeCategoryName(name)).toBe(name);
  });

  it("rejects 51 characters", () => {
    expect(normalizeCategoryName("x".repeat(51))).toBeUndefined();
  });

  it("measures length after trimming, unlike the web nameSchema", () => {
    // 50 real chars wrapped in spaces — the web path's z.max(50) would reject
    // this because .trim() runs after .max(); here it survives.
    expect(normalizeCategoryName(`  ${"x".repeat(50)}  `)).toBe("x".repeat(50));
  });
});
