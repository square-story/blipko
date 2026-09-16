import { describe, it, expect } from "vitest";
import { categoryMatchKey, normalizeCategoryName } from "./categoryName";
import { CATEGORY_TEMPLATE } from "../../domain/categoryTemplate";

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

describe("categoryMatchKey", () => {
  it("folds case and punctuation", () => {
    const key = categoryMatchKey("Eating Out");
    expect(categoryMatchKey("eating out")).toBe(key);
    expect(categoryMatchKey("Eating-Out")).toBe(key);
    expect(categoryMatchKey("  Eating   Out  ")).toBe(key);
  });

  it("folds & and the word and", () => {
    expect(categoryMatchKey("Coffee & Tea")).toBe(
      categoryMatchKey("coffee and tea"),
    );
  });

  it("folds simple plurals", () => {
    expect(categoryMatchKey("Snacks")).toBe(categoryMatchKey("Snack"));
    expect(categoryMatchKey("Gifts")).toBe(categoryMatchKey("Gift"));
  });

  it("folds -ies plurals, which a bare -s strip would miss", () => {
    expect(categoryMatchKey("Groceries")).toBe(categoryMatchKey("Grocery"));
    expect(categoryMatchKey("Utilities")).toBe(categoryMatchKey("Utility"));
    expect(categoryMatchKey("Hobbies")).toBe(categoryMatchKey("Hobby"));
  });

  it("leaves -ss and -us words alone", () => {
    expect(categoryMatchKey("Fitness")).toBe("fitness");
    expect(categoryMatchKey("Miscellaneous")).toBe("miscellaneous");
  });

  it("does NOT merge a leaf with the group that contains it", () => {
    // "Food" and "Food & Drinks" are genuinely different categories. The prompt
    // and the leaves-only hint list keep the model off "Food"; the key must not
    // paper over the difference by merging them.
    expect(categoryMatchKey("Food")).not.toBe(
      categoryMatchKey("Food & Drinks"),
    );
  });

  // The regression guard that matters. Two template names sharing a key would
  // make findByNameForUser ambiguous for every user on the default taxonomy.
  it("assigns a distinct key to every name in CATEGORY_TEMPLATE", () => {
    const names = CATEGORY_TEMPLATE.flatMap((g) => [
      g.name,
      ...g.children.map((c) => c.name),
    ]);
    const byKey = new Map<string, string[]>();
    for (const n of names) {
      const k = categoryMatchKey(n);
      byKey.set(k, [...(byKey.get(k) ?? []), n]);
    }
    const collisions = [...byKey.entries()].filter(([, v]) => v.length > 1);
    expect(collisions).toEqual([]);
    expect(names).toHaveLength(35);
  });
});
