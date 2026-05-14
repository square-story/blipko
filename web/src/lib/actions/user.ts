"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

export async function completeOnboarding() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      hasOnboarded: true,
    },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function generateTelegramLinkToken(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.telegramLinkToken.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, token, expiresAt },
    update: { token, expiresAt },
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) throw new Error("TELEGRAM_BOT_USERNAME not configured");

  return `https://t.me/${botUsername}?start=${token}`;
}

export async function getTelegramConnectionStatus(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  });

  return !!user?.telegramId;
}
