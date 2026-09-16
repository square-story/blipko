import { describe, it, expect, vi } from "vitest";
import { applyCategoryMemory, rememberCategoryChoice } from "./categoryMemory";

const hit = {
  categoryId: "c-coffee",
  categoryName: "Coffee & Tea",
  bucket: "NEEDS" as const,
};

const stubRepo = (found: typeof hit | null) => ({
  findForPhrase: vi.fn().mockResolvedValue(found),
  remember: vi.fn().mockResolvedValue(undefined),
});

const expense = (over: Record<string, unknown> = {}) =>
  ({
    intent: "EXPENSE",
    amount: 30,
    category: "Snacks",
    bucket: "WANTS",
    note: "chai 30",
    confidence: 0.9,
    ...over,
  }) as any;

// A correction is only worth recording if it changes the NEXT parse.
describe("applyCategoryMemory", () => {
  it("rewrites the category and adopts the mapped bucket", async () => {
    const repo = stubRepo(hit);
    const txn = expense();

    await applyCategoryMemory(repo as any, "u1", [txn]);

    expect(repo.findForPhrase).toHaveBeenCalledWith("u1", "chai");
    expect(txn.category).toBe("Coffee & Tea");
    expect(txn.bucket).toBe("NEEDS");
    // confidence also encodes amount ambiguity, which a remembered category
    // says nothing about — lifting it would skip a warranted question.
    expect(txn.confidence).toBe(0.9);
  });

  // Income has its own taxonomy and falls back to "Other Income"
  // (countsAsEarnings: true) — leaking an expense phrase there turns a refund
  // into earnings and widens the user's budget.
  it("never touches a non-EXPENSE transaction", async () => {
    const repo = stubRepo(hit);
    const income = expense({ intent: "INCOME", category: "Refund" });
    const recurring = expense({ intent: "RECURRING" });

    await applyCategoryMemory(repo as any, "u1", [income, recurring]);

    expect(repo.findForPhrase).not.toHaveBeenCalled();
    expect(income.category).toBe("Refund");
    expect(recurring.category).toBe("Snacks");
  });

  // Covers groups and box-linked categories, both refused in the repository.
  it("leaves the parse alone when the repository refuses the mapping", async () => {
    const repo = stubRepo(null);
    const txn = expense();

    await applyCategoryMemory(repo as any, "u1", [txn]);

    expect(txn.category).toBe("Snacks");
    expect(txn.bucket).toBe("WANTS");
  });

  it("does not look up a phrase that normalizes to nothing", async () => {
    const repo = stubRepo(hit);
    await applyCategoryMemory(repo as any, "u1", [expense({ note: "500" })]);
    await applyCategoryMemory(repo as any, "u1", [expense({ note: null })]);
    expect(repo.findForPhrase).not.toHaveBeenCalled();
  });

  it("applies to every item of a batch independently", async () => {
    const repo = {
      findForPhrase: vi
        .fn()
        .mockResolvedValueOnce(hit)
        .mockResolvedValueOnce(null),
      remember: vi.fn(),
    };
    const a = expense({ note: "chai 30" });
    const b = expense({ note: "auto 80" });

    await applyCategoryMemory(repo as any, "u1", [a, b]);

    expect(a.category).toBe("Coffee & Tea");
    expect(b.category).toBe("Snacks");
  });

  it("is inert when no repository is wired", async () => {
    const txn = expense();
    await applyCategoryMemory(null, "u1", [txn]);
    expect(txn.category).toBe("Snacks");
  });
});

describe("rememberCategoryChoice", () => {
  it("stores the normalized key and the phrase as typed", async () => {
    const repo = stubRepo(null);
    const learned = await rememberCategoryChoice(
      repo as any,
      "u1",
      "Chai 30",
      "c-coffee",
    );

    expect(repo.remember).toHaveBeenCalledWith(
      "u1",
      "chai",
      "Chai 30",
      "c-coffee",
    );
    expect(learned).toBe("Chai 30");
  });

  // rawText is not a fallback: BatchProcessor stores the whole message on every
  // item, so "chai 30, auto 80" would teach both expenses the key "chai auto".
  it("learns nothing without a usable note", async () => {
    const repo = stubRepo(null);
    expect(
      await rememberCategoryChoice(repo as any, "u1", null, "c-1"),
    ).toBeNull();
    expect(
      await rememberCategoryChoice(repo as any, "u1", "500", "c-1"),
    ).toBeNull();
    expect(repo.remember).not.toHaveBeenCalled();
  });

  it("learns nothing when the expense ends up uncategorized", async () => {
    const repo = stubRepo(null);
    expect(
      await rememberCategoryChoice(repo as any, "u1", "chai 30", null),
    ).toBeNull();
    expect(repo.remember).not.toHaveBeenCalled();
  });
});
