"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Bucket, RecurringKind } from "@prisma/client";
import {
  recurringRuleSchema,
  type RecurringRuleInput,
} from "@/lib/validations/recurring";

export type RecurringRuleView = {
  id: string;
  kind: RecurringKind;
  amount: number;
  dayOfMonth: number;
  bucket: Bucket | null;
  categoryId: string | null;
  categoryName: string | null;
  note: string | null;
};

export async function getRecurringRules(): Promise<RecurringRuleView[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rules = await prisma.recurringRule.findMany({
    where: { userId: session.user.id, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: [{ kind: "asc" }, { dayOfMonth: "asc" }],
  });

  return rules.map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    dayOfMonth: r.dayOfMonth,
    bucket: r.bucket,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    note: r.note,
  }));
}

export async function createRecurringRule(
  input: RecurringRuleInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const parsed = recurringRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  let bucket: Bucket | null = null;
  let categoryId: string | null = null;

  if (data.kind === "EXPENSE") {
    bucket = (data.bucket as Bucket | undefined) ?? "NEEDS";
    if (data.categoryId) {
      const existing = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (existing) {
        categoryId = existing.id;
        bucket = existing.bucket;
      }
    }
  }

  await prisma.recurringRule.create({
    data: {
      userId,
      kind: data.kind,
      amount: data.amount,
      dayOfMonth: data.dayOfMonth,
      bucket,
      categoryId,
      note: data.note ?? null,
    },
  });

  revalidatePath("/dashboard/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteRecurringRule(
  id: string,
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await prisma.recurringRule.deleteMany({
    where: { id, userId: session.user.id },
  });
  revalidatePath("/dashboard/recurring");
  return { success: true };
}

export async function updateRecurringRule(
  id: string,
  input: RecurringRuleInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const parsed = recurringRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  let bucket: Bucket | null = null;
  let categoryId: string | null = null;

  if (data.kind === "EXPENSE") {
    bucket = (data.bucket as Bucket | undefined) ?? "NEEDS";
    if (data.categoryId) {
      const existing = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (existing) {
        categoryId = existing.id;
        bucket = existing.bucket;
      }
    }
  }

  await prisma.recurringRule.updateMany({
    where: { id, userId },
    data: {
      kind: data.kind,
      amount: data.amount,
      dayOfMonth: data.dayOfMonth,
      bucket,
      categoryId,
      note: data.note ?? null,
    },
  });

  revalidatePath("/dashboard/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}
