"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const renameSchema = z.object({
  oldName: z.string().min(1).max(50),
  newName: z.string().min(1).max(50).trim(),
});

export type CategoryStat = {
  name: string;
  totalSpend: number;
  totalIncome: number;
  transactionCount: number;
};

export async function getCategories(): Promise<CategoryStat[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const txs = await prisma.transaction.findMany({
    where: { userId: session.user.id, isDeleted: false },
    select: { category: true, amount: true, intent: true },
  });

  const map = new Map<string, CategoryStat>();
  for (const tx of txs) {
    const name = tx.category ?? "General";
    const entry = map.get(name) ?? {
      name,
      totalSpend: 0,
      totalIncome: 0,
      transactionCount: 0,
    };
    const amt = Number(tx.amount);
    if (tx.intent === "PAID") entry.totalSpend += amt;
    else if (tx.intent === "RECEIVED") entry.totalIncome += amt;
    entry.transactionCount += 1;
    map.set(name, entry);
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function renameCategory(
  oldName: string,
  newName: string,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsed = renameSchema.safeParse({ oldName, newName });
  if (!parsed.success)
    return { success: false, message: "Invalid category name" };

  const trimmed = parsed.data.newName;
  if (!trimmed) return { success: false, message: "Name cannot be empty" };
  if (trimmed === oldName) return { success: true };

  await prisma.transaction.updateMany({
    where: { userId: session.user.id, category: oldName },
    data: { category: trimmed },
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}
