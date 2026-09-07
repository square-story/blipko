import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaIncomeRepository } from "./PrismaIncomeRepository";

// Two sums that must not be confused. sumForMonth is "money that landed" and
// feeds the income page, Wrapped and the assistant's earnings question.
// sumEarnedForMonth is the BUDGET BASIS and drops refunds, repaid loans and
// advances — money that offsets an expense which already consumed budget.
describe("PrismaIncomeRepository income sums", () => {
  let prisma: any;
  let repo: PrismaIncomeRepository;

  const START = new Date("2026-08-01T00:00:00Z");
  const END = new Date("2026-09-01T00:00:00Z");
  const whereOf = (call: number) =>
    prisma.income.aggregate.mock.calls[call]![0].where;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      income: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    repo = new PrismaIncomeRepository(prisma);
  });

  it("sumForMonth stays gross — no category filter at all", async () => {
    await repo.sumForMonth("u1", START, END);

    const where = whereOf(0);
    expect(where).toEqual({
      userId: "u1",
      isDeleted: false,
      date: { gte: START, lt: END },
    });
    expect(where.NOT).toBeUndefined();
  });

  it("sumEarnedForMonth excludes non-earning categories", async () => {
    await repo.sumEarnedForMonth("u1", START, END);

    expect(whereOf(0).NOT).toEqual({ category: { countsAsEarnings: false } });
  });

  // The subtle one: filtering on countsAsEarnings=true would drop every row
  // written before the taxonomy existed, silently shrinking the budget of every
  // user who has not been backfilled.
  it("keeps uncategorised rows in the basis by negating, not asserting", async () => {
    await repo.sumEarnedForMonth("u1", START, END);

    const where = whereOf(0);
    expect(where.category).toBeUndefined();
    expect(where.NOT.category.countsAsEarnings).toBe(false);
  });

  it("still excludes soft-deleted rows from the basis", async () => {
    await repo.sumEarnedForMonth("u1", START, END);

    expect(whereOf(0).isDeleted).toBe(false);
  });

  it("persists the category when creating income", async () => {
    prisma.income.create = vi.fn().mockResolvedValue({ id: "i1" });

    await repo.create({
      userId: "u1",
      amount: 100,
      rawText: "x",
      confidence: 1,
      categoryId: "cat1",
    });

    expect(prisma.income.create.mock.calls[0]![0].data.categoryId).toBe("cat1");
  });
});
