import { Group, GroupMember } from "@prisma/client";
import {
  GroupContext,
  GroupWithMembers,
  MemberSpendSummary,
} from "../entities/Group";

export interface IGroupRepository {
  create(data: { name: string; createdById: string }): Promise<Group>;
  findById(groupId: string): Promise<Group | null>;
  findByInviteCode(code: string): Promise<Group | null>;
  addMember(
    groupId: string,
    userId: string,
    role: "ADMIN" | "MEMBER",
  ): Promise<GroupMember>;
  removeMember(groupId: string, userId: string): Promise<void>;
  findMembership(groupId: string, userId: string): Promise<GroupMember | null>;
  findMembershipByUser(userId: string): Promise<GroupMember | null>;
  findGroupContextForUser(userId: string): Promise<GroupContext | null>;
  findGroupsByHead(headUserId: string): Promise<GroupWithMembers[]>;
  getGroupSummary(groupId: string): Promise<MemberSpendSummary[]>;
  regenerateInviteCode(groupId: string): Promise<Group>;
}
