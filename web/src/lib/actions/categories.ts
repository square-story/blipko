"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Bucket } from "@prisma/client";
import { currentBudgetPeriod } from "@/lib/budget";

export type CategoryStat = {
  id: string;
  name: string;
  bucket: Bucket;
  isSystem: boolean;
  isGroup: boolean;
  parentId: string | null;
  monthlyBudget: number | null;
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
    spend: spendById.get(c.id) ?? 0,
  }));
}

export async function createCategory(
  name: string,
  bucket: Bucket,
  opts?: { parentId?: string | null; monthlyBudget?: number | null },
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
    },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function setCategoryBudget(
  id: string,
  monthlyBudget: number | null,
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

  await prisma.category.update({
    where: { id },
    data: { monthlyBudget },
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

  // All targets must belong to this user.
  const owned = await prisma.category.findMany({
    where: { userId, id: { in: updates.map((u) => u.id) } },
    select: { id: true },
  });
  if (owned.length !== updates.length)
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
