import { describe, it, expect, vi } from "vitest";
import { PrismaBoxRepository } from "./PrismaBoxRepository";

// The balance check adds these back. Moving a transaction into a box — the
// bot's linked-category diversion or the dashboard's "Move to box" — soft-
// deletes its Expense/Income, so without them every moved spend reads as
// unaccounted money (and every moved income as missing).
describe("PrismaBoxRepository.sumMovedSince", () => {
  const from = new Date("2026-11-01T00:00:00Z");
  const to = new Date("2026-11-10T00:00:00Z");

  it("sums live moved spends and moved income in range, never tracking links", async () => {
    const aggregate = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: "450.00" } })
      .mockResolvedValueOnce({ _sum: { amount: "1000.00" } });
    const repo = new PrismaBoxRepository({ boxEntry: { aggregate } } as any);

    expect(await repo.sumMovedSince("u1", from, to)).toEqual({
      spent: 450,
      income: 1000,
    });
    const base = {
      userId: "u1",
      isTracking: false,
      isDeleted: false,
      date: { gte: from, lt: to },
    };
    expect(aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        ...base,
        direction: "OUT",
        OR: [{ source: "LINKED" }, { sourceExpenseId: { not: null } }],
      },
      _sum: { amount: true },
    });
    expect(aggregate).toHaveBeenNthCalledWith(2, {
      where: { ...base, direction: "IN", sourceIncomeId: { not: null } },
      _sum: { amount: true },
    });
  });

  it("returns zeros when nothing matches", async () => {
    const aggregate = vi.fn().mockResolvedValue({ _sum: { amount: null } });
    const repo = new PrismaBoxRepository({ boxEntry: { aggregate } } as any);
    expect(await repo.sumMovedSince("u1", from, to)).toEqual({
      spent: 0,
      income: 0,
    });
  });
});
