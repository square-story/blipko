import { describe, it, expect } from "vitest";
import {
  buildCategoryBudgetLine,
  buildBucketBudgetLine,
  resolveExpenseCategory,
} from "./expenseFlow";
import { Category } from "@prisma/client";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";

// Minimal stub — resolveExpenseCategory only ever calls these three methods.
function stubCategoryRepo(existing: Partial<Category> | null) {
  const created: Array<{ name: string; bucket: string }> = [];
  const materialized: string[] = [];
  const repo = {
    findByNameForUser: async () => existing as Category | null,
    create: async (data: { name: string; bucket: string }) => {
      created.push({ name: data.name, bucket: data.bucket });
      return { id: "new-cat", name: data.name, isGroup: false } as Category;
    },
    materializeForUser: async (userId: string, systemId: string) => {
      materialized.push(systemId);
      return {
        ...(existing as Category),
        id: "own-cat",
        userId,
      } as Category;
    },
  } as unknown as ICategoryRepository;
  return { repo, created, materialized };
}

describe("buildCategoryBudgetLine", () => {
  it("shows remaining when under a cap", () => {
    const line = buildCategoryBudgetLine("Food", 1000, 200);
    expect(line).toBe("📂 Food: ₹800 left of ₹1,000");
  });

  it("warns when over a cap", () => {
    const line = buildCategoryBudgetLine("Food", 1000, 1200);
    expect(line).toBe("⚠️ Food: ₹200 over its ₹1,000 budget");
  });

  it("shows spend so far when uncapped", () => {
    expect(buildCategoryBudgetLine("Food", null, 500)).toBe(
      "📂 Food: ₹500 spent this cycle",
    );
    expect(buildCategoryBudgetLine("Food", 0, 500)).toBe(
      "📂 Food: ₹500 spent this cycle",
    );
  });
});

describe("buildBucketBudgetLine", () => {
  it("shows remaining + safe-daily when under budget", () => {
    const line = buildBucketBudgetLine("WANTS", 1500, 2000, 10);
    expect(line).toBe("🎯 Wants: ₹1,500 left of ₹2,000 · ₹150/day safe");
  });

  it("warns when a spend bucket is over budget", () => {
    expect(buildBucketBudgetLine("WANTS", -300, 2000, 10)).toBe(
      "⚠️ Wants: ₹300 over budget",
    );
  });

  it("treats overshooting savings as beyond target, not a warning", () => {
    const line = buildBucketBudgetLine("SAVINGS", -300, 2000, 10);
    expect(line).toContain("beyond target");
    expect(line).not.toContain("over budget");
  });

  it("compact form is a terse sub-line", () => {
    expect(
      buildBucketBudgetLine("NEEDS", 4920, 5000, 10, { compact: true }),
    ).toBe("   · Needs: ₹4,920 left");
  });
});

describe("resolveExpenseCategory", () => {
  it("reuses an existing leaf and reports no creation", async () => {
    const { repo, created } = stubCategoryRepo({
      id: "cat-1",
      name: "Food",
      bucket: "WANTS",
      isGroup: false,
    });
    const result = await resolveExpenseCategory(repo, "u1", "NEEDS", "food");
    expect(result.categoryId).toBe("cat-1");
    expect(result.categoryLabel).toBe("Food");
    expect(result.bucket).toBe("WANTS"); // the category's bucket wins
    expect(result.createdCategory).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("creates an unknown category and reports it", async () => {
    const { repo, created } = stubCategoryRepo(null);
    const result = await resolveExpenseCategory(
      repo,
      "u1",
      "WANTS",
      "Biriyani",
    );
    expect(result.categoryId).toBe("new-cat");
    expect(result.createdCategory).toBe(true);
    expect(created).toEqual([{ name: "Biriyani", bucket: "WANTS" }]);
  });

  it("creates with a trimmed, whitespace-collapsed name", async () => {
    const { repo, created } = stubCategoryRepo(null);
    await resolveExpenseCategory(repo, "u1", "WANTS", "  Eating   out  ");
    expect(created).toEqual([{ name: "Eating out", bucket: "WANTS" }]);
  });

  it("drops an over-long name instead of writing it", async () => {
    const { repo, created } = stubCategoryRepo(null);
    const result = await resolveExpenseCategory(
      repo,
      "u1",
      "WANTS",
      "x".repeat(51),
    );
    expect(created).toHaveLength(0);
    expect(result.categoryId).toBeUndefined();
    expect(result.categoryLabel).toBe("General");
    expect(result.createdCategory).toBe(false);
    expect(result.bucket).toBe("WANTS"); // still lands in the parsed bucket
  });

  it("does not create when the name matches a group", async () => {
    const { repo, created } = stubCategoryRepo({
      id: "grp-1",
      name: "Essentials",
      bucket: "NEEDS",
      isGroup: true,
    });
    const result = await resolveExpenseCategory(
      repo,
      "u1",
      "WANTS",
      "Essentials",
    );
    expect(created).toHaveLength(0);
    expect(result.categoryId).toBeUndefined();
    expect(result.bucket).toBe("NEEDS"); // adopts the group's bucket
    expect(result.createdCategory).toBe(false);
  });
});

// Onboarding no longer pre-clones the taxonomy, so a first spend usually matches
// a shared system row. Attaching an expense to one leaves a userId=null
// categoryId that the web ownership checks reject.
describe("resolveExpenseCategory system-row materialization", () => {
  it("materializes a system match into the user's own row", async () => {
    const { repo, created, materialized } = stubCategoryRepo({
      id: "sys-1",
      name: "Fuel",
      bucket: "NEEDS",
      isGroup: false,
      userId: null,
    });
    const result = await resolveExpenseCategory(repo, "u1", "WANTS", "fuel");
    expect(materialized).toEqual(["sys-1"]);
    expect(result.categoryId).toBe("own-cat");
    expect(result.bucket).toBe("NEEDS");
    // Materializing is not inventing — the user is not told "new category".
    expect(result.createdCategory).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("leaves a row the user already owns alone", async () => {
    const { repo, materialized } = stubCategoryRepo({
      id: "own-1",
      name: "Fuel",
      bucket: "NEEDS",
      isGroup: false,
      userId: "u1",
    });
    const result = await resolveExpenseCategory(repo, "u1", "WANTS", "Fuel");
    expect(materialized).toEqual([]);
    expect(result.categoryId).toBe("own-1");
  });

  it("does not materialize a system GROUP", async () => {
    const { repo, created, materialized } = stubCategoryRepo({
      id: "sys-grp",
      name: "Essentials",
      bucket: "NEEDS",
      isGroup: true,
      userId: null,
    });
    const result = await resolveExpenseCategory(
      repo,
      "u1",
      "WANTS",
      "Essentials",
    );
    expect(materialized).toEqual([]);
    expect(created).toHaveLength(0);
    expect(result.categoryId).toBeUndefined();
    expect(result.bucket).toBe("NEEDS"); // still adopts the group's bucket
  });
});
