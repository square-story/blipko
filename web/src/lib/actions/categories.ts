"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Bucket } from "@prisma/client";
import {
  currentBudgetPeriod,
  previousCycles,
  median,
  allocateByWeight,
} from "@/lib/budget";
import { getBudgetOverview } from "@/lib/actions/budget";

export type CategoryStat = {
  id: string;
  name: string;
  bucket: Bucket;
  isSystem: boolean;
  isGroup: boolean;
  parentId: string | null;
  monthlyBudget: number | null;
  budgetLocked: boolean;
  spend: number;
};

const nameSchema = z.string().min(1).max(50).trim();
const bucketSchema = z.enum(["NEEDS", "WANTS", "SAVINGS"]);

export async function getCategories(): Promise<CategoryStat[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payday: true },
  });
  const { start, end } = currentBudgetPeriod(user?.payday ?? 1);

  // Self-healing: If expenses were logged against system categories (userId = null),
  // clone them to user-owned categories so they can be managed.
  const systemLinkedExpenses = await prisma.expense.findMany({
    where: {
      userId,
      isDeleted: false,
      category: { userId: null },
    },
    select: { categoryId: true, category: true },
    distinct: ["categoryId"],
  });

  if (systemLinkedExpenses.length > 0) {
    for (const { category } of systemLinkedExpenses) {
      if (!category) continue;

      let userCat = await prisma.category.findFirst({
        where: { userId, name: category.name },
      });

      if (!userCat) {
        userCat = await prisma.category.create({
          data: {
            name: category.name,
            bucket: category.bucket,
            isGroup: category.isGroup,
            userId,
          },
        });
      }

      await prisma.expense.updateMany({
        where: { userId, categoryId: category.id },
        data: { categoryId: userCat.id },
      });
    }
  }

  const [categories, spendGroups] = await Promise.all([
    // Only the user's own categories. System rows (userId = null) are the bot's
    // fallback taxonomy and would otherwise duplicate the user's cloned copies.
    prisma.category.findMany({
      where: { userId },
      orderBy: [{ bucket: "asc" }, { name: "asc" }],
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: { userId, isDeleted: false, date: { gte: start, lt: end } },
    }),
  ]);

  const spendById = new Map<string, number>();
  for (const g of spendGroups) {
    if (g.categoryId) spendById.set(g.categoryId, Number(g._sum.amount ?? 0));
  }

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    bucket: c.bucket,
    isSystem: c.userId === null,
    isGroup: c.isGroup,
    parentId: c.parentId,
    monthlyBudget: c.monthlyBudget === null ? null : Number(c.monthlyBudget),
    budgetLocked: c.budgetLocked,
    spend: spendById.get(c.id) ?? 0,
  }));
}

export type CategorySuggestion = {
  categoryId: string;
  amount: number | null;
  basis: "recurring" | "history" | "new";
};

const roundTo50 = (n: number) => Math.round(n / 50) * 50;

// Data-driven per-category budget suggestions:
// - "recurring": exact sum of the category's active recurring expenses (fixed).
// - "history": median spend over the last 3 complete cycles, rounded (robust to
//   lumpy months); only when > 0.
// - "new": no signal → no suggestion.
export async function getCategorySuggestions(): Promise<CategorySuggestion[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payday: true },
  });
  const payday = user?.payday ?? 1;

  const [cats, rules] = await Promise.all([
    prisma.category.findMany({
      where: { userId, isGroup: false },
      select: { id: true },
    }),
    prisma.recurringRule.findMany({
      where: {
        userId,
        isActive: true,
        kind: "EXPENSE",
        categoryId: { not: null },
      },
      select: { categoryId: true, amount: true },
    }),
  ]);

  // Fixed: sum of active recurring expenses per category.
  const fixedById = new Map<string, number>();
  for (const r of rules) {
    if (!r.categoryId) continue;
    fixedById.set(
      r.categoryId,
      (fixedById.get(r.categoryId) ?? 0) + Number(r.amount),
    );
  }

  // History: per-category totals across the last 3 complete cycles.
  const cycles = previousCycles(payday, 3); // newest first
  const oldest = cycles[cycles.length - 1]?.start;
  const newestEnd = cycles[0]?.end; // == start of the current (partial) cycle
  const perCatPerCycle = new Map<string, number[]>();
  if (oldest && newestEnd) {
    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        isDeleted: false,
        categoryId: { not: null },
        date: { gte: oldest, lt: newestEnd },
      },
      select: { categoryId: true, amount: true, date: true },
    });
    for (const e of expenses) {
      if (!e.categoryId) continue;
      const idx = cycles.findIndex((c) => e.date >= c.start && e.date < c.end);
      if (idx === -1) continue;
      const arr =
        perCatPerCycle.get(e.categoryId) ?? new Array(cycles.length).fill(0);
      arr[idx] += Number(e.amount);
      perCatPerCycle.set(e.categoryId, arr);
    }
  }

  return cats.map((c): CategorySuggestion => {
    const fixed = fixedById.get(c.id);
    if (fixed && fixed > 0)
      return { categoryId: c.id, amount: fixed, basis: "recurring" };
    const m = median(
      perCatPerCycle.get(c.id) ?? new Array(cycles.length).fill(0),
    );
    if (m > 0)
      return { categoryId: c.id, amount: roundTo50(m), basis: "history" };
    return { categoryId: c.id, amount: null, basis: "new" };
  });
}

export async function createCategory(
  name: string,
  bucket: Bucket,
  opts?: {
    parentId?: string | null;
    monthlyBudget?: number | null;
    locked?: boolean;
  },
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedName = nameSchema.safeParse(name);
  const parsedBucket = bucketSchema.safeParse(bucket);
  if (!parsedName.success || !parsedBucket.success)
    return { success: false, message: "Invalid category" };

  const existing = await prisma.category.findFirst({
    where: { userId: session.user.id, name: parsedName.data },
  });
  if (existing)
    return { success: false, message: "A category with that name exists" };

  // A parent, if given, must be one of the user's own group categories.
  let parentId: string | null = null;
  if (opts?.parentId) {
    const parent = await ownedCategory(opts.parentId, session.user.id);
    if (!parent?.isGroup)
      return { success: false, message: "Invalid parent group" };
    parentId = parent.id;
  }

  await prisma.category.create({
    data: {
      name: parsedName.data,
      bucket: parsedBucket.data,
      userId: session.user.id,
      parentId,
      monthlyBudget: opts?.monthlyBudget ?? null,
      budgetLocked: opts?.locked ?? false,
    },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function setCategoryBudget(
  id: string,
  monthlyBudget: number | null,
  locked?: boolean,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  if (
    monthlyBudget !== null &&
    (!Number.isFinite(monthlyBudget) || monthlyBudget < 0)
  )
    return { success: false, message: "Invalid amount" };

  const cat = await ownedCategory(id, session.user.id);
  if (!cat)
    return { success: false, message: "Category not found or not editable" };
  if (cat.isGroup)
    return { success: false, message: "Groups don't hold a budget" };

  await prisma.category.update({
    where: { id },
    data: {
      monthlyBudget,
      ...(locked !== undefined ? { budgetLocked: locked } : {}),
    },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Sets monthly limits on several owned categories at once (used by Auto-balance).
export async function setCategoryBudgets(
  updates: { id: string; monthlyBudget: number }[],
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  const userId = session.user.id;

  if (
    updates.some(
      (u) => !Number.isFinite(u.monthlyBudget) || u.monthlyBudget < 0,
    )
  )
    return { success: false, message: "Invalid amount" };

  // All targets must belong to this user and be leaf categories (groups don't
  // hold budgets).
  const owned = await prisma.category.findMany({
    where: { userId, id: { in: updates.map((u) => u.id) } },
    select: { id: true, isGroup: true },
  });
  if (owned.length !== updates.length || owned.some((c) => c.isGroup))
    return { success: false, message: "Category not found or not editable" };

  await prisma.$transaction(
    updates.map((u) =>
      prisma.category.update({
        where: { id: u.id },
        data: { monthlyBudget: u.monthlyBudget },
      }),
    ),
  );

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard");
  return { success: true };
}

// Auto-balance: rebalances a bucket so its categories' budgets sum to the bucket
// total. Pinned (locked) categories keep their budget; the remainder is split
// across the unpinned ones weighted by their data-driven suggestion (recurring
// sum or 3-cycle history median). Manual — triggered by the Auto-balance button.
export async function rebalanceBucket(
  bucket: Bucket,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedBucket = bucketSchema.safeParse(bucket);
  if (!parsedBucket.success)
    return { success: false, message: "Invalid bucket" };

  const [overview, cats, suggestions] = await Promise.all([
    getBudgetOverview(),
    getCategories(),
    getCategorySuggestions(),
  ]);

  const bucketBudget =
    overview.buckets.find((b) => b.bucket === bucket)?.budget ?? 0;
  const leaves = cats.filter((c) => !c.isGroup && c.bucket === bucket);
  const unpinned = leaves.filter((c) => !c.budgetLocked);

  if (unpinned.length === 0)
    return {
      success: false,
      message: "No unpinned categories to balance in this bucket.",
    };
  if (bucketBudget <= 0)
    return {
      success: false,
      message: "Set your income first — this bucket has no budget yet.",
    };

  const pinnedSum = leaves
    .filter((c) => c.budgetLocked)
    .reduce((s, c) => s + (c.monthlyBudget ?? 0), 0);
  const remaining = Math.max(0, bucketBudget - pinnedSum);

  const weightById = new Map(
    suggestions.map((s) => [s.categoryId, s.amount ?? 0]),
  );
  const weights = unpinned.map((c) => Math.max(0, weightById.get(c.id) ?? 0));
  const allocations = allocateByWeight(remaining, weights);

  const updates: { id: string; monthlyBudget: number }[] = [];
  unpinned.forEach((c, i) => {
    const amount = allocations[i];
    if (amount !== undefined) updates.push({ id: c.id, monthlyBudget: amount });
  });

  const res = await setCategoryBudgets(updates);
  if (!res.success) return res;
  return {
    success: true,
    message: `Balanced ${updates.length} categor${updates.length === 1 ? "y" : "ies"} to the bucket budget.`,
  };
}

// Loads a user-owned category and rejects system rows / other users' rows.
async function ownedCategory(id: string, userId: string) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== userId) return null;
  return cat;
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success)
    return { success: false, message: "Invalid category name" };

  const cat = await ownedCategory(id, session.user.id);
  if (!cat)
    return { success: false, message: "Category not found or not editable" };

  await prisma.category.update({
    where: { id },
    data: { name: parsedName.data },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function setCategoryBucket(
  id: string,
  bucket: Bucket,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedBucket = bucketSchema.safeParse(bucket);
  if (!parsedBucket.success)
    return { success: false, message: "Invalid bucket" };

  const cat = await ownedCategory(id, session.user.id);
  if (!cat)
    return { success: false, message: "Category not found or not editable" };

  await prisma.category.update({
    where: { id },
    data: { bucket: parsedBucket.data },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function deleteCategory(
  id: string,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const cat = await ownedCategory(id, session.user.id);
  if (!cat)
    return { success: false, message: "Category not found or not editable" };

  // Detach expenses (keep the spend history) before removing the category.
  await prisma.expense.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id } });

  revalidatePath("/dashboard/categories");
  return { success: true };
}
