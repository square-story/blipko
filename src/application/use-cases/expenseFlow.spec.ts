import { describe, it, expect } from "vitest";
import { buildCategoryBudgetLine, buildBucketBudgetLine } from "./expenseFlow";

describe("buildCategoryBudgetLine", () => {
  it("shows remaining when under a cap", () => {
    const line = buildCategoryBudgetLine("Food", 1000, 200);
    expect(line).toBe("📂 Food: ₹800 left of ₹1,000");
  });

  it("warns when over a cap", () => {
    const line = buildCategoryBudgetLine("Food", 1000, 1200);
    expect(line).toBe("⚠️ Food: ₹200 over its ₹1,000 budget");
  });

  it("shows spend so far when uncapped", () => {
    expect(buildCategoryBudgetLine("Food", null, 500)).toBe(
      "📂 Food: ₹500 spent this cycle",
    );
    expect(buildCategoryBudgetLine("Food", 0, 500)).toBe(
      "📂 Food: ₹500 spent this cycle",
    );
  });
});

describe("buildBucketBudgetLine", () => {
  it("shows remaining + safe-daily when under budget", () => {
    const line = buildBucketBudgetLine("WANTS", 1500, 2000, 10);
    expect(line).toBe("🎯 Wants: ₹1,500 left of ₹2,000 · ₹150/day safe");
  });

  it("warns when a spend bucket is over budget", () => {
    expect(buildBucketBudgetLine("WANTS", -300, 2000, 10)).toBe(
      "⚠️ Wants: ₹300 over budget",
    );
  });

  it("treats overshooting savings as beyond target, not a warning", () => {
    const line = buildBucketBudgetLine("SAVINGS", -300, 2000, 10);
    expect(line).toContain("beyond target");
    expect(line).not.toContain("over budget");
  });

  it("compact form is a terse sub-line", () => {
    expect(
      buildBucketBudgetLine("NEEDS", 4920, 5000, 10, { compact: true }),
    ).toBe("   · Needs: ₹4,920 left");
  });
});
