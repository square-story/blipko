"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getWallets() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: [] };

  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return {
    success: true,
    data: wallets.map((w) => ({
      id: w.id,
      name: w.name,
      emoji: w.emoji,
      type: w.type,
      isDefault: w.isDefault,
      transactionCount: w._count.transactions,
      createdAt: w.createdAt.toISOString(),
    })),
  };
}

export async function createWallet(data: {
  name: string;
  emoji?: string;
  type?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  try {
    const wallet = await prisma.wallet.create({
      data: {
        name: data.name,
        emoji: data.emoji ?? "💰",
        type: (data.type as any) ?? "CUSTOM",
        userId: session.user.id,
      },
    });
    revalidatePath("/dashboard/wallets");
    return { success: true, data: wallet };
  } catch {
    return {
      success: false,
      message: "Failed to create wallet (name may already exist)",
    };
  }
}

export async function setDefaultWallet(walletId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  await prisma.$transaction([
    prisma.wallet.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    }),
    prisma.wallet.update({
      where: { id: walletId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/dashboard/wallets");
  return { success: true };
}

export async function deleteWallet(walletId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId, userId: session.user.id },
  });
  if (!wallet) return { success: false, message: "Wallet not found" };
  if (wallet.isDefault)
    return { success: false, message: "Cannot delete the default wallet" };

  await prisma.wallet.delete({ where: { id: walletId } });
  revalidatePath("/dashboard/wallets");
  return { success: true };
}
