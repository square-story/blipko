import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCycleReport } from "./cycleReport";

// payday=1 → calendar-month cycles. On Jun 10 the ended cycle is May, prior is April.
const NOW = new Date(2026, 5, 10);
const user = { id: "u1", monthlyIncome: 50000, payday: 1 };

// Distinguish ended (May, month 4) from prior (April, month 3) by the range start.
const isEnded = (start: Date) => start.getMonth() === 4;

describe("buildCycleReport", () => {
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let incomeRepository: any;
  const deps = () => ({
    expenseRepository,
    budgetConfigRepository,
    incomeRepository,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(50000),
      sumTotalForMonth: vi.fn().mockResolvedValue(50000),
      receivedByCategoryForMonth: vi.fn().mockResolvedValue([]),
    };

    const endedRows = [
      { categoryId: null, bucket: "NEEDS", total: 20000 },
      { categoryId: null, bucket: "WANTS", total: 10000 },
      { categoryId: null, bucket: "SAVINGS", total: 5000 },
    ];
    const priorRows = [
      { categoryId: null, bucket: "NEEDS", total: 25000 },
      { categoryId: null, bucket: "WANTS", total: 12000 },
      { categoryId: null, bucket: "SAVINGS", total: 4000 },
    ];
    expenseRepository = {
      spendByCategoryForMonth: vi.fn((_u: string, start: Date) =>
        Promise.resolve(isEnded(start) ? endedRows : priorRows),
      ),
      categoryTotals: vi.fn((_u: string, start: Date) =>
        Promise.resolve(
          isEnded(start)
            ? [
                { name: "Groceries", total: 8000 },
                { name: "Eating Out", total: 3000 },
              ]
            : [
                { name: "Groceries", total: 9000 },
                { name: "Eating Out", total: 1500 },
              ],
        ),
      ),
    };
  });

  it("builds a report keyed to the ended cycle with the ended-cycle label", async () => {
    const { text, endedKey } = await buildCycleReport(deps(), user, NOW);
    expect(endedKey).toBe("2026-05-01");
    expect(text).toContain("May wrapped");
    expect(text).toContain("Income logged ₹50,000");
  });

  it("headlines the overall spend change vs the prior cycle", async () => {
    // ended total 35,000 vs prior 41,000 → ~15% less.
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).toContain("Spent 15% less than last cycle");
  });

  it("shows per-bucket vs-last deltas and over/under status", async () => {
    const { text } = await buildCycleReport(deps(), user, NOW);
    // Needs 20,000 / 25,000 budget, down from 25,000 → under, ↓20% vs last.
    expect(text).toMatch(
      /Needs.*₹20,000 \/ ₹25,000.*under by ₹5,000.*↓20% vs last/,
    );
  });

  it("names the biggest riser and faller", async () => {
    const { text } = await buildCycleReport(deps(), user, NOW);
    // Eating Out +1,500 (up), Groceries -1,000 (down).
    expect(text).toContain("Eating Out ↑₹1,500");
    expect(text).toContain("Groceries ↓₹1,000");
  });

  it("reports net saved when income exceeds spend", async () => {
    const { text } = await buildCycleReport(deps(), user, NOW);
    // 50,000 income − 35,000 spend = 15,000 saved.
    expect(text).toContain("Net saved ₹15,000");
  });
});
