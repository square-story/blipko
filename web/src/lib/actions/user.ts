"use server";

import { auth } from "@/auth";
import { getAllChangelogEntries } from "@/lib/changelog";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

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

  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
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

export async function unlinkTelegram(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telegramId: null },
  });

  revalidatePath("/dashboard/account");
  return { success: true };
}

export type ChangelogNotice = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  unseen: boolean;
};

export async function getUnseenChangelog(): Promise<{
  unread: number;
  entries: ChangelogNotice[];
}> {
  const session = await auth();
  if (!session?.user?.id) return { unread: 0, entries: [] };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { changelogSeenAt: true, createdAt: true },
  });

  // Never opened → fall back to createdAt so a brand-new signup isn't shown a
  // dot for releases that predate their account.
  const since = user?.changelogSeenAt ?? user?.createdAt ?? new Date();

  const all = getAllChangelogEntries();

  // Mapped explicitly rather than spread: `Content` is a compiled MDX component
  // and would throw when the action result is serialized.
  const entries = all.slice(0, 5).map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    date: entry.date,
    summary: entry.summary,
    unseen: new Date(`${entry.date}T00:00:00Z`) > since,
  }));

  return {
    unread: all.filter((e) => new Date(`${e.date}T00:00:00Z`) > since).length,
    entries,
  };
}

export async function markChangelogSeen(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { changelogSeenAt: new Date() },
  });

  // No revalidatePath on purpose, unlike the other mutations here: nothing
  // rendered on the server depends on changelogSeenAt (the indicator fetches
  // client-side), so revalidating /dashboard would refetch the whole tree for
  // no visible change.
  return { success: true };
}
