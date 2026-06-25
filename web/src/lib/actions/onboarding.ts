"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CATEGORY_TEMPLATE } from "@/lib/category-template";
import {
  DEFAULT_SPLIT,
  localeForCurrency,
  suggestCategoryBudgets,
  type SelectedLeaf,
} from "@/lib/budget";

const schema = z.object({
  monthlyIncome: z.number().positive().max(1_000_000_000),
  currency: z.string().min(1).max(8),
  payday: z.number().int().min(1).max(28).optional(),
  notificationDosage: z.enum(["OFF", "GENTLE", "AGGRESSIVE", "RELENTLESS"]),
  groupKeys: z.array(z.string()).default([]),
});

export type SubmitOnboardingInput = z.infer<typeof schema>;

// Persists the whole onboarding wizard in one transaction: income + currency +
// reminder dosage on the User, a default 50/30/20 BudgetConfig, and the user's
// chosen category groups cloned to leaves with suggested budgets. Mirrors the
// bot wizard's finalize step so web- and bot-onboarded users end up identical.
export async function submitOnboarding(
  input: SubmitOnboardingInput,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid onboarding data",
    };
  }
  const d = parsed.data;
  const userId = session.user.id;

  // Selected template groups → their leaves, with one suggested budget map
  // normalized across all selected leaves (matches the bot).
  const groups = CATEGORY_TEMPLATE.filter((g) => d.groupKeys.includes(g.key));
  const leaves: SelectedLeaf[] = groups.flatMap((g) => g.children);
  const budgets = suggestCategoryBudgets(
    d.monthlyIncome,
    DEFAULT_SPLIT,
    leaves,
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        monthlyIncome: d.monthlyIncome,
        currency: d.currency,
        locale: localeForCurrency(d.currency),
        ...(d.payday !== undefined ? { payday: d.payday } : {}),
        notificationDosage: d.notificationDosage,
        hasOnboarded: true,
        onboardingStep: null,
      },
    });

    await tx.budgetConfig.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_SPLIT },
      update: {},
    });

    // Clone selected groups → leaves, idempotent by (userId, name).
    for (const group of groups) {
      const existingGroup = await tx.category.findFirst({
        where: { userId, name: group.name },
      });
      const groupRow =
        existingGroup ??
        (await tx.category.create({
          data: {
            userId,
            name: group.name,
            bucket: group.bucket,
            isGroup: true,
          },
        }));

      for (const child of group.children) {
        const exists = await tx.category.findFirst({
          where: { userId, name: child.name },
        });
        if (exists) continue;
        await tx.category.create({
          data: {
            userId,
            name: child.name,
            bucket: child.bucket,
            parentId: groupRow.id,
            monthlyBudget: budgets.get(child.name) ?? null,
          },
        });
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categories");
  return { success: true };
}
