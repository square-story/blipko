import { describe, it, expect, vi } from "vitest";
import { PrismaBoxRepository } from "./PrismaBoxRepository";

// The balance check adds these back: a spend diverted into a box soft-deletes
// its Expense, so without them every box-linked spend reads as unaccounted.
describe("PrismaBoxRepository.sumLinkedOutSince", () => {
  it("sums only live, diverted (LINKED, OUT, non-tracking) entries in range", async () => {
    const prisma: any = {
      boxEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: "450.00" } }),
      },
    };
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-10T00:00:00Z");

    const total = await new PrismaBoxRepository(prisma).sumLinkedOutSince(
      "u1",
      from,
      to,
    );

    expect(total).toBe(450);
    expect(prisma.boxEntry.aggregate).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        direction: "OUT",
        source: "LINKED",
        isTracking: false,
        isDeleted: false,
        date: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
  });

  it("returns 0 when nothing matches", async () => {
    const prisma: any = {
      boxEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };
    expect(
      await new PrismaBoxRepository(prisma).sumLinkedOutSince(
        "u1",
        new Date(),
        new Date(),
      ),
    ).toBe(0);
  });
});
