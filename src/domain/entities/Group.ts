export interface GroupContext {
  groupId: string;
  groupName: string;
  role: "ADMIN" | "MEMBER";
  headUserId: string;
  // Platform-agnostic ID (telegramId today; whatsappId / signalId tomorrow).
  // Each future connector stores its own field on User and PrismaGroupRepository
  // returns whichever is populated for the resolved platform.
  headPlatformUserId: string;
}

export interface MemberSpendSummary {
  memberId: string;
  memberName: string;
  totalSpend: number;
  totalReceived: number;
  transactionCount: number;
}

export interface GroupWithMembers {
  id: string;
  name: string;
  inviteCode: string;
  members: Array<{
    userId: string;
    name: string | null;
    role: string;
    joinedAt: Date;
  }>;
}
