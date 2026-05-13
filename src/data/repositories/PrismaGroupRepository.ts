import { PrismaClient, Group, GroupMember } from "@prisma/client";
import { IGroupRepository } from "../../domain/repositories/IGroupRepository";
import {
  GroupContext,
  GroupWithMembers,
  MemberSpendSummary,
} from "../../domain/entities/Group";
import { randomBytes } from "crypto";
import { resolvePlatformUserId } from "../../utils/resolvePlatformUserId";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F9C2B1"
}

export class PrismaGroupRepository implements IGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { name: string; createdById: string }): Promise<Group> {
    return this.prisma.group.create({
      data: {
        name: data.name,
        inviteCode: generateInviteCode(),
        createdById: data.createdById,
      },
    });
  }

  async findById(groupId: string): Promise<Group | null> {
    return this.prisma.group.findUnique({ where: { id: groupId } });
  }

  async findByInviteCode(code: string): Promise<Group | null> {
    return this.prisma.group.findUnique({ where: { inviteCode: code } });
  }

  async addMember(
    groupId: string,
    userId: string,
    role: "ADMIN" | "MEMBER",
  ): Promise<GroupMember> {
    return this.prisma.groupMember.create({
      data: { groupId, userId, role },
    });
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.prisma.groupMember.deleteMany({
      where: { groupId, userId },
    });
  }

  async findMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMember | null> {
    return this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
  }

  async findMembershipByUser(userId: string): Promise<GroupMember | null> {
    return this.prisma.groupMember.findFirst({ where: { userId } });
  }

  async findGroupContextForUser(userId: string): Promise<GroupContext | null> {
    const membership = await this.prisma.groupMember.findFirst({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              where: { role: "ADMIN" },
              include: {
                user: { select: { id: true, telegramId: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!membership) return null;

    const admin = membership.group.members[0];
    if (!admin) return null;

    return {
      groupId: membership.group.id,
      groupName: membership.group.name,
      role: membership.role as "ADMIN" | "MEMBER",
      headUserId: admin.userId,
      headPlatformUserId: resolvePlatformUserId(admin.user) ?? "",
    };
  }

  async findGroupsByHead(headUserId: string): Promise<GroupWithMembers[]> {
    const groups = await this.prisma.group.findMany({
      where: { createdById: headUserId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      inviteCode: g.inviteCode,
      members: g.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    }));
  }

  async getGroupSummary(groupId: string): Promise<MemberSpendSummary[]> {
    const [members, agg] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.transaction.groupBy({
        by: ["groupMemberId", "intent"],
        where: { groupId, isDeleted: false },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return members.map((m) => {
      const paid = agg.find(
        (a) => a.groupMemberId === m.userId && a.intent === "PAID",
      );
      const received = agg.find(
        (a) => a.groupMemberId === m.userId && a.intent === "RECEIVED",
      );
      return {
        memberId: m.userId,
        memberName: m.user.name ?? "Unknown",
        totalSpend: Number(paid?._sum.amount ?? 0),
        totalReceived: Number(received?._sum.amount ?? 0),
        transactionCount: (paid?._count.id ?? 0) + (received?._count.id ?? 0),
      };
    });
  }

  async regenerateInviteCode(groupId: string): Promise<Group> {
    return this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: generateInviteCode() },
    });
  }
}
