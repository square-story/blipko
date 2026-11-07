import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCycleReport } from "./cycleReport";
import { zonedParts } from "../../utils/time";

// payday=1 → calendar-month cycles. On Jun 10 the ended cycle is May, prior is April.
const NOW = new Date(2026, 5, 10);
const user = { id: "u1", monthlyIncome: 50000, payday: 1 };

// Distinguish ended (May) from prior (April) by the range start. Read in IST —
// the boundary is that zone's midnight, which is the prior month in UTC.
const isEnded = (start: Date) => zonedParts(start, "Asia/Kolkata").month === 5;

describe("buildCycleReport", () => {
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let incomeRepository: any;
  // bucket defaults to WANTS; the mock honours categoryTotals' bucket filter.
  let cats: Record<number, { name: string; total: number; bucket?: string }[]>;
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
      sumEarnedForMonth: vi.fn().mockResolvedValue(50000),
      sumCarryForMonth: vi.fn().mockResolvedValue(0),
    };

    const ended: Record<string, number> = {
      NEEDS: 20000,
      WANTS: 10000,
      SAVINGS: 5000,
    };
    const prior: Record<string, number> = {
      NEEDS: 25000,
      WANTS: 12000,
      SAVINGS: 4000,
    };
    cats = {
      5: [
        { name: "Groceries", total: 8000 },
        { name: "Eating Out", total: 3000 },
      ],
      4: [
        { name: "Groceries", total: 9000 },
        { name: "Eating Out", total: 1500 },
      ],
      3: [
        { name: "Groceries", total: 9000 },
        { name: "Eating Out", total: 1000 },
      ],
      2: [
        { name: "Groceries", total: 9000 },
        { name: "Eating Out", total: 1200 },
      ],
    };
    expenseRepository = {
      sumByBucketForMonth: vi.fn((_u: string, bucket: string, start: Date) =>
        Promise.resolve((isEnded(start) ? ended : prior)[bucket] ?? 0),
      ),
      // Keyed on the cycle's IST month: May ended, April prior, Mar/Feb/Jan
      // the baseline that "usual" is computed from.
      categoryTotals: vi.fn(
        (_u: string, start: Date, _end: Date, bucket: string | null) =>
          Promise.resolve(
            (cats[zonedParts(start, "Asia/Kolkata").month] ?? [])
              .filter((c) => !bucket || (c.bucket ?? "WANTS") === bucket)
              .map(({ name, total }) => ({ name, total })),
          ),
      ),
    };
  });

  it("builds a report keyed to the ended cycle with the ended-cycle label", async () => {
    const { text, endedKey } = await buildCycleReport(deps(), user, NOW);
    expect(endedKey).toBe("2026-05-01");
    expect(text).toContain("May wrapped");
    expect(text).toContain("Income ₹50,000");
  });

  // The wrapped report printed the EARNED figure labelled "Income logged", so a
  // refund vanished from it while /status named it.
  it("names the money coming back when gross and earned differ", async () => {
    const d = deps();
    d.incomeRepository.sumForMonth = vi.fn().mockResolvedValue(57000);
    d.incomeRepository.sumEarnedForMonth = vi.fn().mockResolvedValue(50000);

    const { text } = await buildCycleReport(d, user, NOW);
    expect(text).toContain("Income ₹57,000");
    expect(text).toContain("budget on ₹50,000");
    expect(text).toContain("₹7,000 of that is money coming back");
  });

  // Net is computed from the effective figure (which carries the expected-salary
  // floor), so calling it "income − spend" made the on-screen sums not add up.
  it("labels net against the budget, not income", async () => {
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).toContain("(budget − spend)");
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

  // Eating Out: 3,000 in May vs a usual of (1,500 + 1,000 + 1,200) / 3 = 1,233.
  it("adds an unusual line and one next-cycle action", async () => {
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).toContain(
      "Unusual this cycle: Eating Out ₹3,000 (usually ₹1,233)",
    );
    expect(text).toContain(
      "💡 Next cycle: keep Eating Out near its usual ₹1,233 — that frees ₹1,767.",
    );
  });

  it("still ends with a next-cycle action when there is no history", async () => {
    cats = { 5: cats[5]! };
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).not.toContain("Unusual this cycle");
    expect(text).toContain("💡 Next cycle:");
  });

  // April's report would have said "keep Taxi near ₹1,000" (3,000 vs a usual
  // of 1,000 in Mar/Feb); May came in at 900, so the loop closes as done.
  it("reports on last cycle's goal", async () => {
    const AFTER = new Date(2027, 5, 10);
    cats[5] = [...cats[5]!, { name: "Taxi", total: 900 }];
    cats[4] = [...cats[4]!, { name: "Taxi", total: 3000 }];
    cats[3] = [...cats[3]!, { name: "Taxi", total: 1000 }];
    cats[2] = [...cats[2]!, { name: "Taxi", total: 1000 }];
    const { text } = await buildCycleReport(deps(), user, AFTER);
    expect(text).toContain(
      "✅ Last cycle's goal — Taxi near ₹1,000: done (₹900).",
    );
  });

  // A first cycle has no previous report, so there is no goal to check.
  it("omits the follow-up when the prior cycle had no spending", async () => {
    cats = { 5: cats[5]! };
    expenseRepository.sumByBucketForMonth = vi.fn(
      (_u: string, bucket: string, start: Date) =>
        Promise.resolve(
          isEnded(start)
            ? ({ NEEDS: 20000, WANTS: 10000, SAVINGS: 5000 } as any)[bucket]
            : 0,
        ),
    );
    const { text } = await buildCycleReport(
      deps(),
      user,
      new Date(2027, 5, 10),
    );
    expect(text).not.toContain("Last cycle's goal");
  });

  // Reports sent before the goal line shipped carried no goal, so the first
  // report after deploy must not "follow up" on one the user never saw.
  it("does not follow up on a cycle whose report predates goals", async () => {
    cats[4] = [...cats[4]!, { name: "Taxi", total: 3000 }];
    cats[3] = [...cats[3]!, { name: "Taxi", total: 1000 }];
    cats[2] = [...cats[2]!, { name: "Taxi", total: 1000 }];
    const { text } = await buildCycleReport(deps(), user, NOW); // Jun 2026
    expect(text).not.toContain("Last cycle's goal");
  });

  // Saving more than usual is not a problem to fix.
  it("never flags a savings category as unusual", async () => {
    cats[5] = [
      ...cats[5]!,
      { name: "Investments", total: 15000, bucket: "SAVINGS" },
    ];
    for (const m of [4, 3, 2])
      cats[m] = [
        ...cats[m]!,
        { name: "Investments", total: 5000, bucket: "SAVINGS" },
      ];
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).not.toContain("Investments ₹15,000 (usually");
    expect(text).not.toContain("keep Investments near");
  });

  it("words an overrun as past budget, without shaming", async () => {
    expenseRepository.sumByBucketForMonth = vi.fn(
      (_u: string, bucket: string, start: Date) =>
        Promise.resolve(
          isEnded(start)
            ? ({ NEEDS: 30000, WANTS: 25000, SAVINGS: 5000 } as any)[bucket]
            : 0,
        ),
    );
    const { text } = await buildCycleReport(deps(), user, NOW);
    expect(text).toContain("↗ ₹10,000 past budget");
    expect(text).toContain("Spent beyond budget ₹10,000");
    expect(text).not.toMatch(/❌|overspent/);
  });
});
