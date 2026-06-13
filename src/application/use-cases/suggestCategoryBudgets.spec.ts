import { describe, it, expect } from "vitest";
import { suggestCategoryBudgets, SelectedLeaf } from "./budgetMath";

const SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

describe("suggestCategoryBudgets", () => {
  it("splits each bucket's budget across its leaves by weight, preserving the bucket total", () => {
    const leaves: SelectedLeaf[] = [
      { name: "Rent", bucket: "NEEDS", weight: 45 },
      { name: "Groceries", bucket: "NEEDS", weight: 25 },
      { name: "Eating Out", bucket: "WANTS", weight: 18 },
      { name: "Investments", bucket: "SAVINGS", weight: 40 },
    ];
    const out = suggestCategoryBudgets(100000, SPLIT, leaves);

    // NEEDS budget = 50,000 split 45:25 → Rent 32,143 / Groceries 17,857.
    expect(out.get("Rent")! + out.get("Groceries")!).toBe(50000);
    expect(out.get("Rent")).toBeGreaterThan(out.get("Groceries")!);
    // A single leaf in a bucket gets the whole bucket budget.
    expect(out.get("Eating Out")).toBe(30000);
    expect(out.get("Investments")).toBe(20000);
  });

  it("re-normalizes when fewer leaves are selected in a bucket", () => {
    const onlyRent = suggestCategoryBudgets(100000, SPLIT, [
      { name: "Rent", bucket: "NEEDS", weight: 45 },
    ]);
    expect(onlyRent.get("Rent")).toBe(50000); // full NEEDS budget
  });

  it("omits buckets with no selected leaves", () => {
    const out = suggestCategoryBudgets(100000, SPLIT, [
      { name: "Rent", bucket: "NEEDS", weight: 45 },
    ]);
    expect(out.has("Eating Out")).toBe(false);
    expect([...out.keys()]).toEqual(["Rent"]);
  });
});
