import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaCategoryRepository } from "./PrismaCategoryRepository";

// findByNameForUser is what stops the bot minting a near-duplicate row every
// time the model spells a category differently. The two tiers and their order
// are the whole contract; no other spec covers them because every processor
// mocks the interface.
describe("PrismaCategoryRepository.findByNameForUser", () => {
  let prisma: any;
  let repo: PrismaCategoryRepository;

  const rows = (...r: any[]) => prisma.category.findMany.mockResolvedValue(r);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      category: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    };
    repo = new PrismaCategoryRepository(prisma);
  });

  it("matches an exact name case-insensitively", async () => {
    rows({ id: "a", name: "Eating Out", userId: "u1", isGroup: false });
    expect((await repo.findByNameForUser("u1", "eating out"))?.id).toBe("a");
  });

  it("falls back to the match key for a near-duplicate", async () => {
    rows({ id: "a", name: "Snacks", userId: "u1", isGroup: false });
    expect((await repo.findByNameForUser("u1", "Snack"))?.id).toBe("a");
  });

  it("prefers the user's own row over the system template", async () => {
    rows(
      { id: "sys", name: "Fuel", userId: null, isGroup: false },
      { id: "own", name: "Fuel", userId: "u1", isGroup: false },
    );
    expect((await repo.findByNameForUser("u1", "Fuel"))?.id).toBe("own");
  });

  // Tier before owner. If ownership were an outer filter, the user's loose
  // "Fuels" would beat the system row the name actually names.
  it("lets a system row's EXACT match beat the user's key match", async () => {
    rows(
      { id: "sys", name: "Fuel", userId: null, isGroup: false },
      { id: "own", name: "Fuels", userId: "u1", isGroup: false },
    );
    expect((await repo.findByNameForUser("u1", "Fuel"))?.id).toBe("sys");
  });

  it("reaches a group by exact name but never by key", async () => {
    const group = {
      id: "g",
      name: "Food & Drinks",
      userId: "u1",
      isGroup: true,
    };
    rows(group);
    expect((await repo.findByNameForUser("u1", "food & drinks"))?.id).toBe("g");
    // Key-matching a group would send the spend to silently uncategorized.
    rows(group);
    expect(await repo.findByNameForUser("u1", "food and drinks")).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    rows({ id: "a", name: "Rent", userId: "u1", isGroup: false });
    expect(await repo.findByNameForUser("u1", "Biriyani")).toBeNull();
  });
});

// Callers look up then create, which is not atomic; BatchProcessor loops 12
// items. Losing that race must not cost the user their message.
describe("PrismaCategoryRepository.create", () => {
  it("returns the existing row when a concurrent write won the race", async () => {
    const raced = { id: "raced", name: "Gym", userId: "u1" };
    const err: any = new Error("Unique constraint failed");
    // Matches the Prisma.PrismaClientKnownRequestError shape the repo checks.
    Object.setPrototypeOf(
      err,
      (await import("@prisma/client")).Prisma.PrismaClientKnownRequestError
        .prototype,
    );
    err.code = "P2002";

    const prisma: any = {
      category: {
        create: vi.fn().mockRejectedValue(err),
        findUnique: vi.fn().mockResolvedValue(raced),
        findMany: vi.fn(),
      },
    };
    const repo = new PrismaCategoryRepository(prisma);

    const got = await repo.create({
      userId: "u1",
      name: "Gym",
      bucket: "WANTS",
    });

    expect(got).toBe(raced);
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { userId_name: { userId: "u1", name: "Gym" } },
    });
  });

  it("rethrows anything that is not a unique violation", async () => {
    const prisma: any = {
      category: {
        create: vi.fn().mockRejectedValue(new Error("connection lost")),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };
    const repo = new PrismaCategoryRepository(prisma);
    await expect(
      repo.create({ userId: "u1", name: "Gym", bucket: "WANTS" }),
    ).rejects.toThrow("connection lost");
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });
});

// The first spend after onboarding usually lands on a shared system row. This
// turns it into something the user owns, so the web ownership checks accept it
// and the leaf keeps a group.
describe("PrismaCategoryRepository.materializeForUser", () => {
  const sysLeaf = {
    id: "sys-leaf",
    name: "Fuel",
    bucket: "NEEDS",
    isGroup: false,
    userId: null,
    parentId: "sys-grp",
    weight: 12,
    icon: "\u26fd",
  };
  const sysGroup = {
    id: "sys-grp",
    name: "Transportation",
    bucket: "NEEDS",
    isGroup: true,
    userId: null,
    icon: null,
  };

  function stub() {
    const prisma: any = {
      category: {
        findUnique: vi.fn(async ({ where }: any) =>
          where.id === "sys-leaf"
            ? sysLeaf
            : where.id === "sys-grp"
              ? sysGroup
              : null,
        ),
        upsert: vi.fn(async ({ create }: any) => ({
          id: create.isGroup ? "own-grp" : "own-leaf",
          ...create,
        })),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    return { prisma, repo: new PrismaCategoryRepository(prisma) };
  }

  it("clones the leaf under the USER's own group, not the system parent", async () => {
    const { prisma, repo } = stub();
    const got = await repo.materializeForUser("u1", "sys-leaf");

    expect(got.id).toBe("own-leaf");
    const leafCreate = prisma.category.upsert.mock.calls.at(-1)![0].create;
    expect(leafCreate.parentId).toBe("own-grp");
    expect(leafCreate.userId).toBe("u1");

    const groupCreate = prisma.category.upsert.mock.calls[0]![0].create;
    expect(groupCreate).toMatchObject({
      userId: "u1",
      name: "Transportation",
      isGroup: true,
    });
  });

  it("carries weight and icon, but never the budget", async () => {
    const { prisma, repo } = stub();
    await repo.materializeForUser("u1", "sys-leaf");
    const leafCreate = prisma.category.upsert.mock.calls.at(-1)![0].create;
    expect(leafCreate.weight).toBe(12);
    expect(leafCreate.icon).toBe("\u26fd");
    // The system weight is a share of a bucket, not a rupee amount.
    expect(leafCreate.monthlyBudget).toBeNull();
  });

  it("is a no-op for a row the user already owns", async () => {
    const own = { id: "own-1", name: "Fuel", userId: "u1" };
    const prisma: any = {
      category: {
        findUnique: vi.fn().mockResolvedValue(own),
        upsert: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const repo = new PrismaCategoryRepository(prisma);
    expect(await repo.materializeForUser("u1", "own-1")).toBe(own);
    expect(prisma.category.upsert).not.toHaveBeenCalled();
  });
});
