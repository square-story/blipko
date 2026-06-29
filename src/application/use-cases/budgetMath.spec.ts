import { describe, it, expect } from "vitest";
import {
  bucketBudget,
  currentMonthRange,
  currentBudgetPeriod,
  previousCycles,
  periodDayInfo,
  periodKey,
  effectiveMonthlyIncome,
  formatMoney,
  pctSpent,
  progressBar,
  sanitizeMd,
} from "./budgetMath";

const SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

describe("budgetMath", () => {
  it("effective income floors at expected and grows with actual", () => {
    expect(effectiveMonthlyIncome(50000, 0)).toBe(50000); // nothing logged → expected
    expect(effectiveMonthlyIncome(50000, 55000)).toBe(55000); // extra income expands
    expect(effectiveMonthlyIncome(50000, 30000)).toBe(50000); // never below the plan
    expect(effectiveMonthlyIncome(0, 8000)).toBe(8000); // gig worker, no baseline
  });

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

  it("previousCycles returns the n most recent complete cycles, newest first", () => {
    // payday=1 → cycles are calendar months. On Jun 10, current cycle is June;
    // the prior complete cycles are May, then April.
    const cycles = previousCycles(1, 2, new Date(2026, 5, 10));
    expect(cycles[0].start).toEqual(new Date(2026, 4, 1)); // May
    expect(cycles[0].end).toEqual(new Date(2026, 5, 1));
    expect(cycles[1].start).toEqual(new Date(2026, 3, 1)); // April
    expect(cycles[1].end).toEqual(new Date(2026, 4, 1));
  });

  it("previousCycles handles a mid-month payday across month lengths", () => {
    // payday=25: on Jun 26 current cycle is Jun 25–Jul 25; just-ended is May 25–Jun 25.
    const [ended] = previousCycles(25, 1, new Date(2026, 5, 26));
    expect(ended.start).toEqual(new Date(2026, 4, 25));
    expect(ended.end).toEqual(new Date(2026, 5, 25));
  });

  it("payday=1 budget period equals the calendar month", () => {
    const { start, end } = currentBudgetPeriod(1, new Date(2026, 4, 10));
    expect(start).toEqual(new Date(2026, 4, 1));
    expect(end).toEqual(new Date(2026, 5, 1));
  });

  it("payday cycle spans payday→payday across the month boundary", () => {
    // June 12 with payday 25 → cycle is May 25 .. Jun 25
    const before = currentBudgetPeriod(25, new Date(2026, 5, 12));
    expect(before.start).toEqual(new Date(2026, 4, 25));
    expect(before.end).toEqual(new Date(2026, 5, 25));
    // June 26 with payday 25 → cycle is Jun 25 .. Jul 25
    const after = currentBudgetPeriod(25, new Date(2026, 5, 26));
    expect(after.start).toEqual(new Date(2026, 5, 25));
    expect(after.end).toEqual(new Date(2026, 6, 25));
  });

  it("periodDayInfo counts days within the cycle", () => {
    const info = periodDayInfo(1, new Date(2026, 4, 10)); // May 10, payday 1
    expect(info.day).toBe(10);
    expect(info.daysInPeriod).toBe(31);
    expect(info.remainingDays).toBe(22); // 31 - 10 + 1
  });

  it("periodKey is the cycle start date and differs across cycles", () => {
    expect(periodKey(25, new Date(2026, 5, 12))).toBe("2026-05-25");
    expect(periodKey(25, new Date(2026, 5, 26))).toBe("2026-06-25");
    expect(periodKey(1, new Date(2026, 5, 12))).toBe("2026-06-01");
  });
});
