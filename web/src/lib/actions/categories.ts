"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Bucket } from "@prisma/client";
import { currentMonthRange } from "@/lib/budget";

export type CategoryStat = {
  id: string;
  name: string;
  bucket: Bucket;
  isSystem: boolean;
  spend: number;
};

const nameSchema = z.string().min(1).max(50).trim();
const bucketSchema = z.enum(["NEEDS", "WANTS", "SAVINGS"]);

export async function getCategories(): Promise<CategoryStat[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const { start, end } = currentMonthRange();

  const [categories, spendGroups] = await Promise.all([
    prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
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
    spend: spendById.get(c.id) ?? 0,
  }));
}

export async function createCategory(
  name: string,
  bucket: Bucket,
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

  await prisma.category.create({
    data: {
      name: parsedName.data,
      bucket: parsedBucket.data,
      userId: session.user.id,
    },
  });

  revalidatePath("/dashboard/categories");
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
