import { describe, it, expect } from "vitest";
import {
  INCOME_CATEGORY_TEMPLATE,
  INCOME_FALLBACK_CATEGORY,
  resolveIncomeCategory,
} from "./incomeCategoryTemplate";

const rows = [
  { id: "salary", name: "Salary", countsAsEarnings: true },
  { id: "other", name: "Other Income", countsAsEarnings: true },
  { id: "returned", name: "Money Lent Returned", countsAsEarnings: false },
];

describe("resolveIncomeCategory", () => {
  it("matches a name exactly", () => {
    expect(resolveIncomeCategory(rows, "Money Lent Returned")?.id).toBe(
      "returned",
    );
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(resolveIncomeCategory(rows, "  sAlArY ")?.id).toBe("salary");
  });

  // The whole point of sharing this: an unknown or absent name must land on a
  // category that counts as earnings, i.e. the pre-taxonomy behaviour.
  it("falls back to Other Income for an invented name", () => {
    expect(resolveIncomeCategory(rows, "Crypto Airdrop")?.id).toBe("other");
  });

  it("falls back when no name was parsed", () => {
    expect(resolveIncomeCategory(rows, undefined)?.id).toBe("other");
    expect(resolveIncomeCategory(rows, null)?.id).toBe("other");
    expect(resolveIncomeCategory(rows, "   ")?.id).toBe("other");
  });

  it("returns undefined rather than throwing when nothing is seeded", () => {
    expect(resolveIncomeCategory([], "Salary")).toBeUndefined();
  });

  // The fallback name must exist in the seeded taxonomy, or every unknown
  // category silently resolves to undefined and writes a null categoryId.
  it("has a fallback that the template actually seeds", () => {
    expect(
      INCOME_CATEGORY_TEMPLATE.some((c) => c.name === INCOME_FALLBACK_CATEGORY),
    ).toBe(true);
  });
});
