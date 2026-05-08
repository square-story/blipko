import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IGroupRepository } from "../../../domain/repositories/IGroupRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { escapeMarkdown } from "../../../utils/escapeMarkdown";

const CREATE_GROUP_RE = /^create\s+(family|group|family\s+group)\b/i;
const INVITE_CODE_RE = /^[A-Za-z0-9]{6,10}$/;

export class GroupOnboardingProcessor implements MessageProcessor {
  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const text = context.textMessage.trim();
    return CREATE_GROUP_RE.test(text) || INVITE_CODE_RE.test(text);
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const text = context.textMessage.trim();
    const parsed = { intent: "CHAT" as const, amount: 0, name: "Unknown" };

    if (CREATE_GROUP_RE.test(text)) {
      return this.handleCreateGroup(context, parsed);
    }
    return this.handleJoinGroup(context, text, parsed);
  }

  private async handleCreateGroup(
    context: ProcessContext,
    parsed: any,
  ): Promise<ProcessOutput> {
    const existing = await this.groupRepository.findMembershipByUser(
      context.user.id,
    );
    if (existing) {
      const response =
        "You're already in a group. One group per user is supported in v1.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const group = await this.groupRepository.create({
      name: `${context.user.name ?? "Family"}'s Group`,
      createdById: context.user.id,
    });
    await this.groupRepository.addMember(group.id, context.user.id, "ADMIN");

    const response = `👨‍👩‍👧 *Group created!*\n\nInvite code: \`${group.inviteCode}\`\n\nShare this code with family members — they send it to the bot to join. Their transactions will appear in your dashboard.`;
    // group.inviteCode is system-generated hex — no escaping needed
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }

  private async handleJoinGroup(
    context: ProcessContext,
    code: string,
    parsed: any,
  ): Promise<ProcessOutput> {
    const existingMembership = await this.groupRepository.findMembershipByUser(
      context.user.id,
    );
    if (existingMembership) {
      const response =
        "You're already in a group. One group per user is supported in v1.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const group = await this.groupRepository.findByInviteCode(
      code.toUpperCase(),
    );
    if (!group) {
      // Not a group code — fall through by returning a neutral response
      // that tells the orchestrator there's nothing more to do.
      // (canHandle already ran, so we need to send something meaningful)
      const response =
        "Code not found. Ask your group head for a fresh invite, or send a transaction message.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    if (group.createdById === context.user.id) {
      const response = "You already own this group.";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    await this.groupRepository.addMember(group.id, context.user.id, "MEMBER");

    // Notify the group head
    const headMembership = await this.groupRepository.findGroupContextForUser(
      context.user.id,
    );
    if (headMembership?.headPlatformUserId) {
      this.messageService
        .sendMessage({
          to: headMembership.headPlatformUserId,
          body: `👋 *${escapeMarkdown(context.user.name ?? "A new member")}* joined your group! Their transactions will now appear in your family dashboard.`,
        })
        .catch(console.error);
    }

    const response = `✅ You've joined *${escapeMarkdown(group.name)}*!\n\nYour transactions will appear in the admin's dashboard. Keep tracking as usual!`;
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
