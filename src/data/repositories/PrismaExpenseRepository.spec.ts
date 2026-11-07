import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaExpenseRepository } from "./PrismaExpenseRepository";

// A category name can match BOTH the shared system template (userId: null) and
// the user's own copy. Their expenses point at their OWN row, so resolving the
// filter to the template makes the query succeed and return nothing — the
// assistant then reports "no spending" for a category in active use.
describe("PrismaExpenseRepository.findRecent category resolution", () => {
  let prisma: any;
  let repo: PrismaExpenseRepository;

  const systemRow = { id: "sys", name: "Fuel", userId: null };
  const ownRow = { id: "own", name: "Fuel", userId: "u1" };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      category: { findMany: vi.fn() },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
    };
    repo = new PrismaExpenseRepository(prisma);
  });

  it("filters on the user's own category, not the system template", async () => {
    prisma.category.findMany.mockResolvedValue([systemRow, ownRow]);

    await repo.findRecent("u1", { limit: 10, categoryName: "Fuel" });

    expect(prisma.expense.findMany.mock.calls[0]![0].where.categoryId).toBe(
      "own",
    );
  });

  it("picks the user's row regardless of the order rows come back in", async () => {
    prisma.category.findMany.mockResolvedValue([ownRow, systemRow]);

    await repo.findRecent("u1", { limit: 10, categoryName: "Fuel" });

    expect(prisma.expense.findMany.mock.calls[0]![0].where.categoryId).toBe(
      "own",
    );
  });

  it("falls back to the system template when the user has no copy", async () => {
    prisma.category.findMany.mockResolvedValue([systemRow]);

    await repo.findRecent("u1", { limit: 10, categoryName: "Fuel" });

    expect(prisma.expense.findMany.mock.calls[0]![0].where.categoryId).toBe(
      "sys",
    );
  });

  it("returns no rows for an unknown category rather than dropping the filter", async () => {
    prisma.category.findMany.mockResolvedValue([]);

    const rows = await repo.findRecent("u1", {
      limit: 10,
      categoryName: "Nonexistent",
    });

    expect(rows).toEqual([]);
    // Silently ignoring the filter would return the user's whole history and
    // report it as spending on a category they never had.
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("does not resolve a category at all when no filter is given", async () => {
    await repo.findRecent("u1", { limit: 10 });

    expect(prisma.category.findMany).not.toHaveBeenCalled();
    expect(prisma.expense.findMany.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      isDeleted: false,
    });
  });
});

// The evening "nothing logged" prompt is about what the user typed. A rent
// rule auto-posting at 06:00 must not count as the user having logged today.
describe("PrismaExpenseRepository.hasManualExpenseSince", () => {
  it("counts live expenses since the time, excluding auto-posted recurring ones", async () => {
    const prisma: any = { expense: { count: vi.fn().mockResolvedValue(0) } };
    const repo = new PrismaExpenseRepository(prisma);
    const from = new Date(Date.UTC(2026, 5, 15));

    expect(await repo.hasManualExpenseSince("u1", from)).toBe(false);
    expect(prisma.expense.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        isDeleted: false,
        date: { gte: from },
        NOT: { rawText: { startsWith: "[recurring]" } },
      },
    });

    prisma.expense.count.mockResolvedValue(2);
    expect(await repo.hasManualExpenseSince("u1", from)).toBe(true);
  });
});
