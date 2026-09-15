"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CARRY_INCOME_CATEGORY } from "@/lib/budget";

// Mirrors src/application/use-cases/carryFlow.ts. Its own SAVINGS leaf and
// never a box-linked category: assigning a box-linked category to an expense
// makes updateExpense divert it into that box and soft-delete it, which would
// post the same money twice.
const CARRY_EXPENSE_CATEGORY = "Carried Forward";

const schema = z.object({
  // The cycle this settles. Sent back from the prompt so a stale tab cannot
  // settle the cycle the user is actually in.
  cycleKey: z.string().min(1).max(10),
  amount: z.number().positive().max(1_000_000_000),
  destination: z.enum(["savings", "opening"]),
  boxId: z.string().min(1).optional(),
});

export type SettleCarryInput = z.infer<typeof schema>;

export async function settleCarryForward(
  input: SettleCarryInput,
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  const userId = session.user.id;

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid carry-forward",
    };
  }
  const { cycleKey, amount, destination, boxId } = parsed.data;

  // Claim the cycle before writing. Conditional update, so a second tab — or
  // the Telegram buttons — cannot carry the same leftover twice.
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      // `not` alone skips NULL rows, which is every user who has never settled.
      OR: [{ carryDecidedKey: null }, { carryDecidedKey: { not: cycleKey } }],
    },
    data: { carryDecidedKey: cycleKey },
  });
  if (count !== 1) {
    return { success: false, message: "That cycle is already settled" };
  }

  if (destination === "opening") {
    const category = await prisma.incomeCategory.findFirst({
      where: { name: CARRY_INCOME_CATEGORY, userId: null },
      select: { id: true },
    });
    await prisma.income.create({
      data: {
        userId,
        amount,
        rawText: `carry forward ${amount} as opening balance`,
        confidence: 1,
        note: CARRY_INCOME_CATEGORY,
        categoryId: category?.id ?? null,
      },
    });
    revalidateCarry();
    return { success: true };
  }

  const category = await prisma.category.upsert({
    where: { userId_name: { userId, name: CARRY_EXPENSE_CATEGORY } },
    update: {},
    create: { userId, name: CARRY_EXPENSE_CATEGORY, bucket: "SAVINGS" },
    select: { id: true },
  });
  const expense = await prisma.expense.create({
    data: {
      userId,
      amount,
      bucket: "SAVINGS",
      categoryId: category.id,
      note: CARRY_EXPENSE_CATEGORY,
      rawText: `carry forward ${amount} to savings`,
      confidence: 1,
    },
  });

  if (boxId) {
    const box = await prisma.box.findFirst({
      where: { id: boxId, userId, isArchived: false },
      select: { id: true },
    });
    if (box) {
      // LINKED to the expense, and the expense stays live — unlike a move-to-box,
      // which soft-deletes its source. The expense is the savings, the entry
      // says which envelope it landed in; sourceExpenseId keeps analytics from
      // counting both.
      await prisma.boxEntry.create({
        data: {
          boxId: box.id,
          userId,
          amount,
          direction: "IN",
          source: "LINKED",
          note: CARRY_EXPENSE_CATEGORY,
          sourceExpenseId: expense.id,
        },
      });
    }
  }

  revalidateCarry();
  return { success: true };
}

// Carrying money moves the budget basis, the expense list, the box balances and
// every chart built on them.
function revalidateCarry(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/categories");
}
