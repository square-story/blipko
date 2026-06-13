import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialDataTools } from "./FinancialDataTools";

const user = {
  id: "u1",
  monthlyIncome: 50000,
  payday: 1,
  currency: "INR",
  locale: "en-IN",
};

describe("FinancialDataTools", () => {
  let userRepository: any;
  let expenseRepository: any;
  let incomeRepository: any;
  let budgetConfigRepository: any;
  let recurringRuleRepository: any;
  let categoryRepository: any;
  let tools: FinancialDataTools;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = { findById: vi.fn().mockResolvedValue(user) };
    expenseRepository = {
      sumByBucketForMonth: vi.fn((_u, bucket) =>
        Promise.resolve(
          (
            { NEEDS: 10000, WANTS: 6000, SAVINGS: 2000 } as Record<
              string,
              number
            >
          )[bucket] ?? 0,
        ),
      ),
      categoryTotals: vi
        .fn()
        .mockResolvedValue([{ name: "Food", total: 1200 }]),
      findRecent: vi.fn().mockResolvedValue([
        {
          date: new Date("2026-06-10T00:00:00Z"),
          amount: 220,
          bucket: "WANTS",
          categoryName: "Food",
          note: "lunch",
        },
      ]),
    };
    incomeRepository = { sumForMonth: vi.fn().mockResolvedValue(50000) };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    recurringRuleRepository = { findByUserId: vi.fn().mockResolvedValue([]) };
    categoryRepository = { findById: vi.fn().mockResolvedValue(null) };

    tools = new FinancialDataTools(
      userRepository,
      expenseRepository,
      incomeRepository,
      budgetConfigRepository,
      recurringRuleRepository,
      categoryRepository,
    );
  });

  it("computes per-bucket budget/spent/remaining from the 50/30/20 split", async () => {
    const status = await tools.getPeriodStatus("u1");
    const needs = status.buckets.find((b) => b.bucket === "NEEDS")!;
    expect(needs.budget).toBe(25000); // 50% of 50000
    expect(needs.spent).toBe(10000);
    expect(needs.remaining).toBe(15000);
    expect(needs.pct).toBe(40);
    expect(status.currency).toBe("INR");
  });

  it("returns all buckets when none specified, one when scoped", async () => {
    const all = await tools.getSpendByBucket("u1", {});
    expect(all).toHaveLength(3);
    const wants = await tools.getSpendByBucket("u1", {}, "WANTS");
    expect(wants).toEqual([{ bucket: "WANTS", total: 6000 }]);
  });

  it("passes a bucket filter and limit to categoryTotals", async () => {
    const cats = await tools.getSpendByCategory("u1", {}, "WANTS", 3);
    expect(cats).toEqual([{ name: "Food", total: 1200 }]);
    const call = expenseRepository.categoryTotals.mock.calls[0];
    expect(call[3]).toBe("WANTS"); // bucket
    expect(call[4]).toBe(3); // limit
  });

  it("maps recent expenses to ISO dates", async () => {
    const recent = await tools.getRecentExpenses("u1", { limit: 5 });
    expect(recent[0]).toMatchObject({
      amount: 220,
      bucket: "WANTS",
      category: "Food",
      note: "lunch",
    });
    expect(recent[0].date).toBe("2026-06-10T00:00:00.000Z");
  });
});
