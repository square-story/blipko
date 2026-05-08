"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getRecurringCharges() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: [] };

  const charges = await prisma.recurringCharge.findMany({
    where: { userId: session.user.id, isActive: true, isDeleted: false },
    include: {
      wallet: { select: { name: true, emoji: true } },
      contact: { select: { name: true } },
      dues: {
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { dayOfMonth: "asc" },
  });

  return {
    success: true,
    data: charges.map((c) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount),
      direction: c.direction,
      period: c.period,
      dayOfMonth: c.dayOfMonth,
      walletName: c.wallet ? `${c.wallet.emoji} ${c.wallet.name}` : null,
      contactName: c.contact?.name ?? null,
      nextDueDate: c.dues[0]?.dueDate.toISOString() ?? null,
      nextDueStatus: c.dues[0]?.status ?? null,
    })),
  };
}

export async function getUpcomingDues(days: number = 30) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: [] };

  const upTo = new Date();
  upTo.setDate(upTo.getDate() + days);

  const dues = await prisma.dueEntry.findMany({
    where: {
      charge: { userId: session.user.id },
      dueDate: { lte: upTo },
      status: { in: ["PENDING", "PARTIAL"] },
    },
    include: {
      charge: { select: { description: true, direction: true } },
      wallet: { select: { name: true, emoji: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return {
    success: true,
    data: dues.map((d) => ({
      id: d.id,
      description: d.charge.description,
      direction: d.charge.direction,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
      dueDate: d.dueDate.toISOString(),
      status: d.status,
      walletName: d.wallet ? `${d.wallet.emoji} ${d.wallet.name}` : null,
    })),
  };
}

export async function markDueAsPaid(dueId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const due = await prisma.dueEntry.findFirst({
    where: { id: dueId, charge: { userId: session.user.id } },
  });
  if (!due) return { success: false, message: "Due not found" };

  await prisma.dueEntry.update({
    where: { id: dueId },
    data: { status: "PAID", paidAmount: due.amount, paidAt: new Date() },
  });

  revalidatePath("/dashboard/recurring");
  return { success: true };
}

export async function deactivateRecurringCharge(chargeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  await prisma.recurringCharge.updateMany({
    where: { id: chargeId, userId: session.user.id },
    data: { isActive: false },
  });

  revalidatePath("/dashboard/recurring");
  return { success: true };
}
