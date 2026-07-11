import { prisma } from "@/lib/prisma";

// If `categoryId` is linked to an (active) box, transfer the expense into that
// box — create a LINKED withdrawal and soft-delete the Expense — mirroring the
// Telegram bot's ingest-time diversion (ExpenseProcessor → recordBoxEntry).
// Plain server-side helper (NOT a server action): callers pass the already
// authenticated userId. targetReachedAt is left to the box cron sweep.
export async function divertExpenseToLinkedBox(
  userId: string,
  args: {
    expenseId: string;
    categoryId: string;
    amount: number;
    note: string | null;
    date: Date;
  },
): Promise<{ transferred: boolean; boxName?: string }> {
  const box = await prisma.box.findFirst({
    where: { userId, categoryId: args.categoryId, isArchived: false },
  });
  if (!box) return { transferred: false };

  await prisma.$transaction([
    prisma.boxEntry.create({
      data: {
        boxId: box.id,
        userId,
        amount: args.amount,
        direction: "OUT",
        source: "LINKED",
        note: args.note,
        date: args.date,
      },
    }),
    prisma.expense.update({
      where: { id: args.expenseId },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
  ]);

  return { transferred: true, boxName: box.name };
}
