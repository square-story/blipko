"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Bucket } from "@prisma/client";
import {
  currentBudgetPeriod,
  periodDayInfo,
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
  icon: string | null;
  spend: number;
};

const nameSchema = z.string().min(1).max(50).trim();
const bucketSchema = z.enum(["NEEDS", "WANTS", "SAVINGS"]);
const iconSchema = z.string().min(1).max(32);

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
    icon: c.icon,
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
    icon?: string | null;
  },
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedName = nameSchema.safeParse(name);
  const parsedBucket = bucketSchema.safeParse(bucket);
  if (!parsedName.success || !parsedBucket.success)
    return { success: false, message: "Invalid category" };

  const icon =
    opts?.icon != null ? (iconSchema.safeParse(opts.icon).data ?? null) : null;

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
      icon,
    },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Create a leaf category on the fly (from the CategoryCombobox) and return the
// full CategoryStat so the caller can select it immediately without a refetch.
export async function createInlineCategory(
  name: string,
  bucket: Bucket,
  icon?: string | null,
): Promise<{ success: boolean; message?: string; category?: CategoryStat }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedName = nameSchema.safeParse(name);
  const parsedBucket = bucketSchema.safeParse(bucket);
  if (!parsedName.success || !parsedBucket.success)
    return { success: false, message: "Invalid category" };

  const resolvedIcon =
    icon != null ? (iconSchema.safeParse(icon).data ?? null) : null;

  const existing = await prisma.category.findFirst({
    where: { userId: session.user.id, name: parsedName.data },
  });
  if (existing)
    return { success: false, message: "A category with that name exists" };

  const created = await prisma.category.create({
    data: {
      name: parsedName.data,
      bucket: parsedBucket.data,
      userId: session.user.id,
      icon: resolvedIcon,
    },
  });

  revalidatePath("/dashboard/categories");
  return {
    success: true,
    category: {
      id: created.id,
      name: created.name,
      bucket: created.bucket,
      isSystem: false,
      isGroup: false,
      parentId: null,
      monthlyBudget: null,
      budgetLocked: false,
      icon: created.icon,
      spend: 0,
    },
  };
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

export async function setCategoryIcon(
  id: string,
  icon: string,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsedIcon = iconSchema.safeParse(icon);
  if (!parsedIcon.success) return { success: false, message: "Invalid icon" };

  const cat = await ownedCategory(id, session.user.id);
  if (!cat)
    return { success: false, message: "Category not found or not editable" };

  await prisma.category.update({
    where: { id },
    data: { icon: parsedIcon.data },
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

export type CategoryDetail = CategoryStat & {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date; // exclusive
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  txnCount: number;
  avgTxn: number;
  largest: { amount: number; note: string | null; date: Date } | null;
  prevSpend: number; // previous complete cycle
  deltaPct: number | null; // null when there is nothing to compare against
  topNotes: { note: string; count: number; total: number }[];
  currency: string;
  locale: string;
};

// Everything the per-category detail page needs about one leaf category, scoped
// to the current payday cycle so the numbers match the cards on /categories.
export async function getCategoryDetail(
  id: string,
): Promise<CategoryDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const cat = await ownedCategory(id, userId);
  // Groups hold no expenses of their own — only leaves get a detail page.
  if (!cat || cat.isGroup) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payday: true, currency: true, locale: true },
  });
  const payday = user?.payday ?? 1;
  const { start, end } = currentBudgetPeriod(payday);
  const { day, daysInPeriod, remainingDays } = periodDayInfo(payday);
  const prev = previousCycles(payday, 1)[0];

  const [rows, prevAgg] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId,
        categoryId: id,
        isDeleted: false,
        date: { gte: start, lt: end },
      },
      select: { amount: true, note: true, date: true },
      orderBy: { amount: "desc" },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        categoryId: id,
        isDeleted: false,
        date: { gte: prev.start, lt: prev.end },
      },
    }),
  ]);

  // One pass over the cycle's rows covers spend, count, average and the notes
  // histogram. Notes are freeform from Telegram, so they're keyed case- and
  // whitespace-insensitively ("Bigbasket weekly" and "bigbasket weekly" are one).
  let spend = 0;
  const notes = new Map<
    string,
    { note: string; count: number; total: number }
  >();
  for (const r of rows) {
    const amount = Number(r.amount);
    spend += amount;
    const raw = r.note?.trim();
    if (!raw) continue;
    const hit = notes.get(raw.toLowerCase());
    if (hit) {
      hit.count += 1;
      hit.total += amount;
    } else {
      notes.set(raw.toLowerCase(), { note: raw, count: 1, total: amount });
    }
  }

  const prevSpend = Number(prevAgg._sum.amount ?? 0);
  const locale = user?.locale ?? "en-IN";
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

  return {
    id: cat.id,
    name: cat.name,
    bucket: cat.bucket,
    isSystem: cat.userId === null,
    isGroup: cat.isGroup,
    parentId: cat.parentId,
    monthlyBudget:
      cat.monthlyBudget === null ? null : Number(cat.monthlyBudget),
    budgetLocked: cat.budgetLocked,
    icon: cat.icon,
    spend,
    periodLabel: `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 86400000))}`,
    periodStart: start,
    periodEnd: end,
    day,
    daysInPeriod,
    remainingDays,
    txnCount: rows.length,
    avgTxn: rows.length > 0 ? spend / rows.length : 0,
    // Rows are ordered by amount, so the first one is the biggest hit.
    largest: rows[0]
      ? {
          amount: Number(rows[0].amount),
          note: rows[0].note,
          date: rows[0].date,
        }
      : null,
    prevSpend,
    deltaPct: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
    // Only repeats are interesting — a list of unique notes is just the table again.
    topNotes: [...notes.values()]
      .filter((n) => n.count > 1)
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 5),
    currency: user?.currency ?? "INR",
    locale,
  };
}

// One category's spend per budget cycle, oldest first, with the current partial
// cycle as the last point. Mirrors getBoxContributionTrend in boxes.ts.
export async function getCategorySpendTrend(
  id: string,
  cycles: number = 6,
): Promise<{ label: string; spend: number }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const n = Math.min(Math.max(Math.floor(cycles) || 6, 1), 24);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payday: true, locale: true },
  });
  const payday = user?.payday ?? 1;
  const windows = [
    ...previousCycles(payday, n - 1).reverse(),
    currentBudgetPeriod(payday),
  ];

  const rows = await prisma.expense.findMany({
    where: {
      userId,
      categoryId: id,
      isDeleted: false,
      date: { gte: windows[0].start, lt: windows[windows.length - 1].end },
    },
    select: { amount: true, date: true },
  });

  const fmt = new Intl.DateTimeFormat(user?.locale ?? "en-IN", {
    month: "short",
    year: "2-digit",
  });
  const series = windows.map((w) => ({ label: fmt.format(w.start), spend: 0 }));
  for (const r of rows) {
    const i = windows.findIndex((w) => r.date >= w.start && r.date < w.end);
    if (i >= 0) series[i].spend += Number(r.amount);
  }
  return series;
}
