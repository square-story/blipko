import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IWalletRepository } from "../../../domain/repositories/IWalletRepository";
import { IGroupRepository } from "../../../domain/repositories/IGroupRepository";
import { IRecurringChargeRepository } from "../../../domain/repositories/IRecurringChargeRepository";
import { IDueEntryRepository } from "../../../domain/repositories/IDueEntryRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

const KNOWN_COMMANDS = new Set([
  "/wallets",
  "/wallet",
  "/group",
  "/dues",
  "/recurring",
  "/help",
]);

export class SlashCommandProcessor implements MessageProcessor {
  constructor(
    private readonly walletRepository: IWalletRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly recurringChargeRepository: IRecurringChargeRepository,
    private readonly dueEntryRepository: IDueEntryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const msg = context.textMessage.trim();
    if (!msg.startsWith("/")) return false;
    const cmd = (msg.split(/\s+/)[0] ?? "").toLowerCase();
    return KNOWN_COMMANDS.has(cmd);
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parts = context.textMessage.trim().split(/\s+/);
    const cmd = (parts[0] ?? "/help").toLowerCase();
    const arg = parts.slice(1).join(" ").trim();

    let response: string;
    switch (cmd) {
      case "/wallets":
        response = await this.handleWallets(context.user.id);
        break;
      case "/wallet":
        response = await this.handleWalletSwitch(context.user.id, arg);
        break;
      case "/group":
        response = await this.handleGroup(context.user.id);
        break;
      case "/dues":
        response = await this.handleDues(context.user.id);
        break;
      case "/recurring":
        response = await this.handleRecurring(context.user.id);
        break;
      default:
        response = this.handleHelp();
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed: context.parsed ?? { intent: "CHAT" } };
  }

  private async handleWallets(userId: string): Promise<string> {
    const wallets = await this.walletRepository.findByUserId(userId);
    if (wallets.length === 0) {
      return "No wallets yet. Transactions go to Personal by default.";
    }
    const lines = wallets.map(
      (w) => `• ${w.name}${w.isDefault ? " ✓" : ""}`,
    );
    return `💳 Your wallets:\n${lines.join("\n")}\n\nSwitch with /wallet <name>`;
  }

  private async handleWalletSwitch(
    userId: string,
    name: string,
  ): Promise<string> {
    if (!name) return this.handleWallets(userId);
    const wallet = await this.walletRepository.findByName(userId, name);
    if (!wallet) {
      return `No wallet named "${name}" found. Use /wallets to see your wallets.`;
    }
    if (wallet.isDefault) {
      return `${wallet.name} is already your default wallet.`;
    }
    await this.walletRepository.setDefault(wallet.id, userId);
    return `✅ Switched to ${wallet.name} wallet`;
  }

  private async handleGroup(userId: string): Promise<string> {
    const ctx = await this.groupRepository.findGroupContextForUser(userId);
    if (!ctx) {
      return `You're not in a group yet.\n\nCreate one: "create family group"\nJoin one: send the invite code`;
    }
    const group = await this.groupRepository.findById(ctx.groupId);
    const inviteCode = group?.inviteCode ?? "N/A";
    const roleLabel = ctx.role === "ADMIN" ? "admin" : "member";
    return `👥 ${ctx.groupName}\nYour role: ${roleLabel}\n🔗 Invite code: ${inviteCode}`;
  }

  private async handleDues(userId: string): Promise<string> {
    const dues = await this.dueEntryRepository.findUpcomingByUser(userId, 5);
    if (dues.length === 0) return "No pending dues. You're all clear! ✅";
    const lines = dues.map((d) => {
      const date = d.dueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
      const amount = Number(d.amount).toLocaleString("en-IN");
      return `• ${d.charge.description} — ₹${amount} on ${date}`;
    });
    return `📋 Upcoming dues:\n${lines.join("\n")}`;
  }

  private async handleRecurring(userId: string): Promise<string> {
    const charges = await this.recurringChargeRepository.findByUserId(userId);
    if (charges.length === 0) {
      return "No recurring charges set up yet.\n\nTry: \"remind me rent ₹8000 on 1st every month\"";
    }
    const lines = charges.map((c) => {
      const amount = Number(c.amount).toLocaleString("en-IN");
      const dir = c.direction === "INCOME" ? "income" : "expense";
      return `• ${c.description} ₹${amount} on ${c.dayOfMonth}th (${c.period.toLowerCase()} · ${dir})`;
    });
    return `🔁 Recurring charges:\n${lines.join("\n")}`;
  }

  private handleHelp(): string {
    return (
      "Available commands:\n\n" +
      "/wallets — list your wallets\n" +
      "/wallet <name> — switch default wallet\n" +
      "/group — show group info and invite code\n" +
      "/dues — upcoming due payments\n" +
      "/recurring — active recurring charges\n" +
      "/help — show this message"
    );
  }
}
