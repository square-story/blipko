import { describe, it, expect } from "vitest";
import {
  bucketBudget,
  currentMonthRange,
  formatMoney,
  monthDayInfo,
  pctSpent,
  progressBar,
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

  it("computes integer percent spent, guarding zero budget", () => {
    expect(pctSpent(21400, 25000)).toBe(86);
    expect(pctSpent(0, 25000)).toBe(0);
    expect(pctSpent(100, 0)).toBe(0);
  });

  it("renders a clamped 10-char progress bar", () => {
    expect(progressBar(0)).toBe("░░░░░░░░░░");
    expect(progressBar(50)).toBe("█████░░░░░");
    expect(progressBar(100)).toBe("██████████");
    expect(progressBar(150)).toBe("██████████"); // clamped
  });

  it("reports day-of-month info with at least one remaining day", () => {
    const info = monthDayInfo(new Date(2026, 4, 10)); // May 10, 31-day month
    expect(info.day).toBe(10);
    expect(info.daysInMonth).toBe(31);
    expect(info.remainingDays).toBe(22); // 31 - 10 + 1
  });
});
