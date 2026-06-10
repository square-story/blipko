import { describe, it, expect } from "vitest";
import {
  bucketBudget,
  currentMonthRange,
  formatMoney,
  sanitizeMd,
} from "./budgetMath";

const SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

describe("budgetMath", () => {
  it("computes per-bucket budgets from income and split", () => {
    expect(bucketBudget(50000, SPLIT, "NEEDS")).toBe(25000);
    expect(bucketBudget(50000, SPLIT, "WANTS")).toBe(15000);
    expect(bucketBudget(50000, SPLIT, "SAVINGS")).toBe(10000);
  });

  it("returns a half-open current month range", () => {
    const { start, end } = currentMonthRange(new Date(2026, 4, 15));
    expect(start).toEqual(new Date(2026, 4, 1));
    expect(end).toEqual(new Date(2026, 5, 1));
  });

  it("formats money in en-IN grouping with a rupee sign", () => {
    expect(formatMoney(14780)).toBe("₹14,780");
    expect(formatMoney(50000)).toBe("₹50,000");
  });

  it("strips markdown control chars from user text", () => {
    expect(sanitizeMd("net_flix *bill*")).toBe("netflix bill");
  });
});
