"use server";

import { auth, signOut } from "@/auth";
import { getAllChangelogEntries } from "@/lib/changelog";
import { isDeleteConfirmed } from "@/lib/delete-confirm";
import { redactExport } from "@/lib/export-redact";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// Everything Blipko stores about the signed-in user, as pretty JSON (DPDP
// right of access). Auth/link relations are never selected; redactExport is
// the backstop if someone adds them later.
export async function exportMyData(): Promise<{
  success: boolean;
  json?: string;
  message?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      expenses: true,
      incomes: true,
      budgetConfig: true,
      categories: true,
      incomeCategories: true,
      categoryMemories: true,
      logs: true,
      budgetNudges: true,
      recurringRules: true,
      boxes: true,
      boxEntries: true,
      conversationMessages: true,
      pendingActions: true,
      clarityScores: true,
    },
  });
  if (!user) return { success: false, message: "Account not found" };

  return { success: true, json: JSON.stringify(redactExport(user), null, 2) };
}

// Hard-deletes the signed-in user. Every user-owned table cascades from User
// (ParseLog included), so one delete erases expenses, chat history and raw
// message logs. VerificationToken is keyed by email, not a FK, so it goes
// explicitly. The typed confirmation is re-checked here: the dialog's check is
// UX, this one is the gate. Signing out first lets NextAuth delete its own
// session row; doing it after the cascade made its adapter throw P2025.
export async function deleteMyAccount(confirmation: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  const { id, email } = session.user;
  if (!isDeleteConfirmed(confirmation, email)) {
    return { success: false, message: "Confirmation didn't match" };
  }

  await signOut({ redirect: false });
  try {
    await prisma.$transaction([
      ...(email
        ? [
            prisma.verificationToken.deleteMany({
              where: { identifier: email },
            }),
          ]
        : []),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (err) {
    console.error(`Account delete failed for ${id}:`, err);
    return {
      success: false,
      message: "Couldn't delete your account. Sign in and try again.",
    };
  }
  redirect("/");
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
