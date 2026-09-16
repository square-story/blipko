import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaCategoryMemoryRepository } from "./PrismaCategoryMemoryRepository";

describe("PrismaCategoryMemoryRepository.findForPhrase", () => {
  let prisma: any;
  let repo: PrismaCategoryMemoryRepository;

  const row = (category: Record<string, unknown>) => ({
    id: "m1",
    category: {
      id: "c1",
      name: "Coffee & Tea",
      bucket: "WANTS",
      isGroup: false,
      box: null,
      ...category,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = { categoryMemory: { findUnique: vi.fn(), upsert: vi.fn() } };
    repo = new PrismaCategoryMemoryRepository(prisma);
  });

  it("returns the mapped category with its bucket", async () => {
    prisma.categoryMemory.findUnique.mockResolvedValue(row({}));
    expect(await repo.findForPhrase("u1", "chai")).toEqual({
      categoryId: "c1",
      categoryName: "Coffee & Tea",
      bucket: "WANTS",
    });
  });

  it("returns null when nothing was learned", async () => {
    prisma.categoryMemory.findUnique.mockResolvedValue(null);
    expect(await repo.findForPhrase("u1", "chai")).toBeNull();
  });

  // Expenses never attach to a group, so applying this mapping would land every
  // future match uncategorized — strictly worse than the parser's own guess.
  it("refuses a group row", async () => {
    prisma.categoryMemory.findUnique.mockResolvedValue(row({ isGroup: true }));
    expect(await repo.findForPhrase("u1", "chai")).toBeNull();
  });

  // ExpenseProcessor diverts box-linked categories BEFORE the confidence gate
  // and writes a BoxEntry with no Expense row — the result never reaches
  // Needs-Review and has no edit path, so a bad mapping here could never be
  // unlearned by the very corrections that create mappings.
  it("refuses a box-linked category", async () => {
    prisma.categoryMemory.findUnique.mockResolvedValue(
      row({ box: { id: "b1", name: "Tokyo" } }),
    );
    expect(await repo.findForPhrase("u1", "chai")).toBeNull();
  });
});

describe("PrismaCategoryMemoryRepository.remember", () => {
  it("overwrites the category on re-correction and counts the hit", async () => {
    const prisma: any = {
      categoryMemory: {
        findUnique: vi.fn(),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    await new PrismaCategoryMemoryRepository(prisma).remember(
      "u1",
      "chai",
      "Chai",
      "c-new",
    );

    const arg = prisma.categoryMemory.upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({
      userId_phraseKey: { userId: "u1", phraseKey: "chai" },
    });
    // Re-correcting the same phrase must replace the category, not duplicate it
    // — that is the only way a wrong mapping gets unlearned.
    expect(arg.update.categoryId).toBe("c-new");
    expect(arg.update.hits).toEqual({ increment: 1 });
    expect(arg.create).toMatchObject({
      userId: "u1",
      phraseKey: "chai",
      categoryId: "c-new",
    });
  });
});
