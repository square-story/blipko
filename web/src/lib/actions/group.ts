"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

function generateInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function getGroupData() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: null };

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { role: "asc" },
          },
        },
      },
    },
  });

  if (!membership) return { success: true, data: null };

  return {
    success: true,
    data: {
      groupId: membership.group.id,
      groupName: membership.group.name,
      inviteCode: membership.group.inviteCode,
      role: membership.role,
      members: membership.group.members.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? "Unknown",
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    },
  };
}

export async function getGroupMemberTransactions(memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: [] };

  // Verify the requester is in the same group as admin
  const requesterMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, role: "ADMIN" },
    select: { groupId: true },
  });
  if (!requesterMembership) return { success: false, data: [] };

  const txs = await prisma.transaction.findMany({
    where: {
      groupId: requesterMembership.groupId,
      groupMemberId: memberId,
      isDeleted: false,
    },
    include: { contact: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return {
    success: true,
    data: txs.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      intent: t.intent,
      description: t.description,
      category: t.category,
      date: t.date.toISOString(),
      contactName: t.contact?.name ?? null,
    })),
  };
}

export async function createGroup() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const existing = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
  });
  if (existing)
    return {
      success: false,
      message: "You are already in a group. One group per user in v1.",
    };

  const group = await prisma.group.create({
    data: {
      name: `${session.user.name ?? "Family"}'s Group`,
      inviteCode: generateInviteCode(),
      createdById: session.user.id,
      members: { create: { userId: session.user.id, role: "ADMIN" } },
    },
  });

  revalidatePath("/dashboard/family");
  return { success: true, data: { inviteCode: group.inviteCode } };
}

export async function removeMember(memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const adminMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, role: "ADMIN" },
  });
  if (!adminMembership)
    return { success: false, message: "Only admins can remove members" };

  if (memberId === session.user.id)
    return { success: false, message: "Cannot remove yourself" };

  const targetMember = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId: adminMembership.groupId, userId: memberId },
    },
  });
  if (targetMember?.role === "ADMIN") {
    const adminCount = await prisma.groupMember.count({
      where: { groupId: adminMembership.groupId, role: "ADMIN" },
    });
    if (adminCount <= 1)
      return { success: false, message: "Cannot remove the last admin" };
  }

  await prisma.groupMember.deleteMany({
    where: { groupId: adminMembership.groupId, userId: memberId },
  });

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function regenerateInviteCode() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const adminMembership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id, role: "ADMIN" },
  });
  if (!adminMembership)
    return {
      success: false,
      message: "Only admins can regenerate the invite code",
    };

  const group = await prisma.group.update({
    where: { id: adminMembership.groupId },
    data: { inviteCode: generateInviteCode() },
  });

  revalidatePath("/dashboard/family");
  return { success: true, data: { inviteCode: group.inviteCode } };
}
