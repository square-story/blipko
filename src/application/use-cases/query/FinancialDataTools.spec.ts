import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FinancialDataTools } from "./FinancialDataTools";

const user = {
  id: "u1",
  monthlyIncome: 50000,
  payday: 1,
  currency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
};

const SPEND: Record<string, number> = {
  NEEDS: 10000,
  WANTS: 6000,
  SAVINGS: 2000,
};

describe("FinancialDataTools", () => {
  let userRepository: any;
  let expenseRepository: any;
  let incomeRepository: any;
  let budgetConfigRepository: any;
  let recurringRuleRepository: any;
  let categoryRepository: any;
  let boxRepository: any;
  let tools: FinancialDataTools;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mid-cycle so `remainingDays` is stable across runs (payday 1, August).
    vi.setSystemTime(new Date("2026-08-11T06:00:00Z"));

    userRepository = { findById: vi.fn().mockResolvedValue(user) };
    expenseRepository = {
      sumByBucketForMonth: vi.fn((_u, bucket) =>
        Promise.resolve(SPEND[bucket] ?? 0),
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
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(50000),
      sumEarnedForMonth: vi.fn().mockResolvedValue(50000),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    recurringRuleRepository = { findByUserId: vi.fn().mockResolvedValue([]) };
    categoryRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findAllForUser: vi.fn().mockResolvedValue([
        {
          id: "c1",
          name: "Food",
          bucket: "WANTS",
          isGroup: false,
          monthlyBudget: 5000,
        },
        {
          id: "g1",
          name: "Living",
          bucket: "NEEDS",
          isGroup: true,
          monthlyBudget: null,
        },
      ]),
    };
    boxRepository = { listWithBalances: vi.fn().mockResolvedValue([]) };

    tools = new FinancialDataTools(
      userRepository,
      expenseRepository,
      incomeRepository,
      budgetConfigRepository,
      recurringRuleRepository,
      categoryRepository,
      boxRepository,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPeriodStatus", () => {
    it("computes per-bucket budget/spent/remaining from the 50/30/20 split", async () => {
      const status = await tools.getPeriodStatus("u1");
      const needs = status.buckets.find((b) => b.bucket === "NEEDS")!;
      expect(needs.budget).toBe("₹25,000"); // 50% of 50000
      expect(needs.spent).toBe("₹10,000");
      expect(needs.remaining).toBe("₹15,000");
      expect(needs.pct).toBe(40);
      expect(status.currency).toBe("INR");
    });

    it("decides the bucket status server-side so the model never compares", async () => {
      expenseRepository.sumByBucketForMonth = vi.fn((_u, bucket) =>
        Promise.resolve(
          { NEEDS: 24000, WANTS: 20000, SAVINGS: 0 }[bucket as string] ?? 0,
        ),
      );
      const status = await tools.getPeriodStatus("u1");
      const by = (b: string) => status.buckets.find((x) => x.bucket === b)!;

      expect(by("NEEDS").status).toBe("NEAR_LIMIT"); // 24000/25000 = 96%
      expect(by("WANTS").status).toBe("OVER"); // 20000/15000 = 133%
      expect(by("SAVINGS").status).toBe("NO_ACTIVITY");
    });

    it("frames over-target SAVINGS as good, unlike an over-budget WANTS", async () => {
      expenseRepository.sumByBucketForMonth = vi.fn((_u, bucket) =>
        Promise.resolve(
          { NEEDS: 0, WANTS: 20000, SAVINGS: 12000 }[bucket as string] ?? 0,
        ),
      );
      const status = await tools.getPeriodStatus("u1");
      const by = (b: string) => status.buckets.find((x) => x.bucket === b)!;

      expect(by("SAVINGS").status).toBe("OVER");
      expect(by("SAVINGS").interpretation).toMatch(/good/i);
      expect(by("WANTS").interpretation).toMatch(/over budget/i);
    });
  });

  describe("date ranges", () => {
    it("anchors a model-supplied date to the user's timezone, not UTC", async () => {
      await tools.getSpendByBucket("u1", {
        from: "2026-08-01",
        to: "2026-08-01",
      });
      const [, , from, to] =
        expenseRepository.sumByBucketForMonth.mock.calls[0];

      // IST midnight on Aug 1 is 18:30 UTC on Jul 31 — a bare new Date() would
      // have started the window 5.5h early and swept in Jul 31 evening spends.
      expect(from.toISOString()).toBe("2026-07-31T18:30:00.000Z");
      // `to` is inclusive on the wire, so the window covers all of Aug 1.
      expect(to.toISOString()).toBe("2026-08-01T18:30:00.000Z");
    });

    it("echoes back the inclusive range it actually used", async () => {
      const res = await tools.getSpendByBucket("u1", {
        from: "2026-08-01",
        to: "2026-08-07",
      });
      expect(res.range).toEqual({ from: "2026-08-01", to: "2026-08-07" });
    });

    it("defaults to the current cycle when no range is given", async () => {
      const res = await tools.getSpendByBucket("u1", {});
      expect(res.range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    });
  });

  describe("absence is not zero", () => {
    it("notes an empty spend result instead of implying ₹0 was spent", async () => {
      expenseRepository.sumByBucketForMonth = vi.fn().mockResolvedValue(0);
      const res = await tools.getSpendByBucket("u1", {});
      expect(res.note).toMatch(/NOT the same as/i);
    });

    it("notes an empty category result", async () => {
      expenseRepository.categoryTotals = vi.fn().mockResolvedValue([]);
      const res = await tools.getSpendByCategory("u1", {});
      expect(res.note).toMatch(/NOT the same as/i);
    });

    it("does not add a note when there is real data", async () => {
      const res = await tools.getSpendByBucket("u1", {});
      expect(res.note).toBeUndefined();
    });
  });

  describe("checkAffordability", () => {
    // WANTS: 15000 budget − 6000 spent = 9000 remaining.
    it("returns YES with a decided verdict, not raw operands", async () => {
      const res = await tools.checkAffordability("u1", 1000, "WANTS");
      expect(res.verdict).toBe("YES");
      expect(res.remainingBefore).toBe("₹9,000");
      expect(res.remainingAfter).toBe("₹8,000");
      expect(res.reason).toMatch(/fits comfortably/i);
    });

    it("returns TIGHT when the purchase eats more than half of what's left", async () => {
      const res = await tools.checkAffordability("u1", 5000, "WANTS");
      expect(res.verdict).toBe("TIGHT");
    });

    it("returns NO and a negative remainder when it overshoots", async () => {
      const res = await tools.checkAffordability("u1", 12000, "WANTS");
      expect(res.verdict).toBe("NO");
      expect(res.remainingAfter).toBe("-₹3,000");
      expect(res.reason).toMatch(/over budget by ₹3,000/i);
    });

    it("defaults to the WANTS bucket for a discretionary purchase", async () => {
      const res = await tools.checkAffordability("u1", 100);
      expect(res.bucket).toBe("WANTS");
    });

    it("says NO when there is no budget at all rather than inventing one", async () => {
      userRepository.findById.mockResolvedValue({ ...user, monthlyIncome: 0 });
      incomeRepository.sumForMonth.mockResolvedValue(0);
      incomeRepository.sumEarnedForMonth.mockResolvedValue(0);
      const res = await tools.checkAffordability("u1", 100, "WANTS");
      expect(res.verdict).toBe("NO");
      expect(res.reason).toMatch(/no income recorded/i);
    });
  });

  describe("compareCycles", () => {
    it("computes the direction and delta itself", async () => {
      // Current cycle spends 18000 total; the previous one 9000.
      let call = 0;
      expenseRepository.sumByBucketForMonth = vi.fn(() =>
        Promise.resolve(call++ < 3 ? 6000 : 3000),
      );
      const res = await tools.compareCycles("u1", 1);

      expect(res.cycles[0]!.label).toBe("current");
      expect(res.cycles[1]!.label).toBe("previous");
      expect(res.vsPrevious).toMatchObject({
        direction: "UP",
        deltaPct: 100,
        delta: "+₹9,000",
      });
    });

    it("warns that the current cycle is partial", async () => {
      const res = await tools.compareCycles("u1", 1);
      expect(res.vsPrevious!.note).toMatch(/day 11 of 31/);
      expect(res.vsPrevious!.note).toMatch(/partial cycle/i);
    });

    it("reports a sub-5% swing as FLAT rather than a trend", async () => {
      let call = 0;
      expenseRepository.sumByBucketForMonth = vi.fn(() =>
        Promise.resolve(call++ < 3 ? 3400 : 3333),
      );
      const res = await tools.compareCycles("u1", 1);
      expect(res.vsPrevious!.direction).toBe("FLAT");
    });
  });

  describe("categories and boxes", () => {
    it("exposes leaves only — a group can never hold an expense", async () => {
      const res = await tools.getCategories("u1");
      expect(res.categories).toEqual([
        { name: "Food", bucket: "WANTS", monthlyBudget: "₹5,000" },
      ]);
    });

    it("collapses the system template and the user's own copy into one entry", async () => {
      // findAllForUser returns both rows. Left alone, most names appear twice —
      // duplicated in the tool schema's enum and in what the model reads back.
      categoryRepository.findAllForUser.mockResolvedValue([
        {
          id: "sys",
          name: "Fuel",
          bucket: "NEEDS",
          isGroup: false,
          monthlyBudget: null,
          userId: null,
        },
        {
          id: "own",
          name: "Fuel",
          bucket: "NEEDS",
          isGroup: false,
          monthlyBudget: 2000,
          userId: "u1",
        },
      ]);
      const res = await tools.getCategories("u1");

      expect(res.categories).toHaveLength(1);
      // The user's own row wins, so their budget shows rather than the blank template.
      expect(res.categories[0]).toEqual({
        name: "Fuel",
        bucket: "NEEDS",
        monthlyBudget: "₹2,000",
      });
    });

    it("keeps the user's row regardless of which order they come back in", async () => {
      categoryRepository.findAllForUser.mockResolvedValue([
        {
          id: "own",
          name: "Fuel",
          bucket: "NEEDS",
          isGroup: false,
          monthlyBudget: 2000,
          userId: "u1",
        },
        {
          id: "sys",
          name: "Fuel",
          bucket: "NEEDS",
          isGroup: false,
          monthlyBudget: null,
          userId: null,
        },
      ]);
      const res = await tools.getCategories("u1");
      expect(res.categories[0]!.monthlyBudget).toBe("₹2,000");
    });

    it("reports box progress toward target", async () => {
      boxRepository.listWithBalances.mockResolvedValue([
        { name: "New York trip", balance: 5000, targetAmount: 20000 },
      ]);
      const res = await tools.getBoxes("u1");
      expect(res.boxes[0]).toEqual({
        name: "New York trip",
        balance: "₹5,000",
        target: "₹20,000",
        pctOfTarget: 25,
      });
    });
  });

  it("passes a bucket filter and limit to categoryTotals", async () => {
    const cats = await tools.getSpendByCategory("u1", {}, "WANTS", 3);
    expect(cats.categories).toEqual([{ name: "Food", total: "₹1,200" }]);
    const call = expenseRepository.categoryTotals.mock.calls[0];
    expect(call[3]).toBe("WANTS"); // bucket
    expect(call[4]).toBe(3); // limit
  });

  it("formats recent expenses as local dates and formatted amounts", async () => {
    const recent = await tools.getRecentExpenses("u1", { limit: 5 });
    expect(recent.rows[0]).toEqual({
      date: "2026-06-10",
      amount: "₹220",
      bucket: "WANTS",
      category: "Food",
      note: "lunch",
    });
  });

  it("resolves recurring category names in one lookup, not one per rule", async () => {
    recurringRuleRepository.findByUserId.mockResolvedValue([
      {
        kind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1,
        bucket: "NEEDS",
        categoryId: "c1",
        note: "rent",
      },
      {
        kind: "EXPENSE",
        amount: 199,
        dayOfMonth: 5,
        bucket: "WANTS",
        categoryId: "c1",
        note: "netflix",
      },
    ]);
    const res = await tools.getRecurringRules("u1");

    expect(res.rules.map((r) => r.category)).toEqual(["Food", "Food"]);
    expect(res.rules[0]!.amount).toBe("₹8,000");
    expect(categoryRepository.findAllForUser).toHaveBeenCalledTimes(1);
    expect(categoryRepository.findById).not.toHaveBeenCalled();
  });
});
