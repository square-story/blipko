import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IGroupRepository } from "../../../domain/repositories/IGroupRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { escapeMarkdown } from "../../../utils/escapeMarkdown";

export class GroupQueryProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    if (!context.groupContext) return false;
    const type = context.parsed?.query_details?.type;
    return type === "GROUP_SUMMARY" || type === "MEMBER_SPEND";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const groupCtx = context.groupContext!;
    const queryType = parsed.query_details?.type;

    if (queryType === "GROUP_SUMMARY") {
      return this.handleGroupSummary(context, groupCtx.groupId, parsed);
    }
    return this.handleMemberSpend(context, groupCtx, parsed);
  }

  private async handleGroupSummary(
    context: ProcessContext,
    groupId: string,
    parsed: any,
  ): Promise<ProcessOutput> {
    if (context.groupContext?.role !== "ADMIN") {
      const response = "Only the group admin can see the full family summary.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const summaries = await this.groupRepository.getGroupSummary(groupId);

    if (summaries.length === 0) {
      const response = "No transactions yet in your family group.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const lines = summaries.map(
      (s) =>
        `👤 *${escapeMarkdown(s.memberName)}*\n  📤 Spent: ₹${s.totalSpend.toFixed(2)}  📥 Received: ₹${s.totalReceived.toFixed(2)}  (${s.transactionCount} txns)`,
    );

    const response = `👨‍👩‍👧 *Family Summary*\n\n${lines.join("\n\n")}`;
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }

  private async handleMemberSpend(
    context: ProcessContext,
    groupCtx: { groupId: string; role: string },
    parsed: any,
  ): Promise<ProcessOutput> {
    // MEMBER can only see their own; ADMIN can query anyone
    const targetName = parsed.query_details?.contactName;

    if (groupCtx.role !== "ADMIN" || !targetName) {
      // Show the requesting user's own transactions
      const txs = await this.transactionRepository.findByGroupAndMember(
        groupCtx.groupId,
        context.user.id,
      );
      const total = txs
        .filter((t) => t.intent === "PAID")
        .reduce((s, t) => s + Number(t.amount), 0);
      const response = `📊 *Your group spending:* ₹${total.toFixed(2)} (${txs.length} entries)`;
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    // Admin looking up a specific member by name
    const summaries = await this.groupRepository.getGroupSummary(
      groupCtx.groupId,
    );
    const match = summaries.find((s) =>
      s.memberName.toLowerCase().includes(targetName.toLowerCase()),
    );

    if (!match) {
      const response = `No member named "${targetName}" found in your group.`;
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const response = `📊 *${escapeMarkdown(match.memberName)}'s spending*\n\n📤 Spent: ₹${match.totalSpend.toFixed(2)}\n📥 Received: ₹${match.totalReceived.toFixed(2)}\n🔢 Transactions: ${match.transactionCount}`;
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
