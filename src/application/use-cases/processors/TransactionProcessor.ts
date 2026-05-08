import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IContactRepository } from "../../../domain/repositories/IContactRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

import { ParsedIntent } from "../../../domain/entities/ParsedData";

const isTransactionIntent = (
  intent: ParsedIntent,
): intent is Extract<ParsedIntent, "PAID" | "RECEIVED"> =>
  intent === "PAID" || intent === "RECEIVED";

export class TransactionProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly contactRepository: IContactRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return !!context.parsed && isTransactionIntent(context.parsed.intent);
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    if (typeof parsed.amount !== "number") {
      throw new Error("Amount is required for CREDIT or DEBIT intents");
    }

    let contact = null;
    if (parsed.name) {
      contact = await this.ensureContactExists(context.user.id, parsed.name);
    }

    const transaction = await this.transactionRepository.create({
      amount: parsed.amount,
      intent: parsed.intent as "PAID" | "RECEIVED",
      description: parsed.description || parsed.category || "General",
      userId: context.user.id,
      category: parsed.category,
      contactId: contact?.id,
      walletId: context.walletId,
      ...(context.groupContext && {
        groupId: context.groupContext.groupId,
        groupMemberId: context.user.id,
      }),
    });

    let newBalance = 0;
    if (contact) {
      const updatedContact = await this.contactRepository.findById(contact.id);
      if (updatedContact) {
        newBalance = Number(updatedContact.currentBalance);
      }
    }

    const response = `✅ *Entry Added*

${parsed.intent === "PAID" ? "🔻 *Paid:*" : "🟩 *Received:*"} ₹${transaction.amount.toFixed(2)}
👤 ${parsed.intent === "PAID" ? "To" : "From"}: ${contact ? contact.name : "Unknown"}
📝 *Note:* ${transaction.description || "None"}

💰 *New Balance:* ₹${newBalance.toFixed(2)} ${newBalance < 0 ? "🔴 (Due)" : "🟢 (Credit)"}

_Add more entries or ask for your balance anytime!_`;

    const messageId = await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });

    // Link the confirmation message to the transaction
    await this.transactionRepository.updateConfirmationMessageId(
      transaction.id,
      messageId,
    );

    // Notify the group head (fire-and-forget; platform-agnostic via IMessagingPlatform)
    if (
      context.groupContext &&
      context.groupContext.headPlatformUserId &&
      context.groupContext.headPlatformUserId !== context.platformUserId
    ) {
      const directionLabel =
        parsed.intent === "PAID" ? "📤 Paid" : "📥 Received";
      const memberName = context.user.name ?? "A member";
      this.messageService
        .sendMessage({
          to: context.groupContext.headPlatformUserId,
          body: `👨‍👩‍👧 *${memberName}* added: ${directionLabel} ₹${parsed.amount}\n📝 ${transaction.description ?? ""}`,
        })
        .catch(console.error);
    }

    return { response, parsed };
  }

  private async ensureContactExists(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    // 1. Try fuzzy match first (covers exact match too)
    const existing = await this.contactRepository.findSimilarByName(
      userId,
      name,
    );
    console.log("existing", existing);
    if (existing) {
      return existing;
    }
    // 2. If no match, check exact strictly (redundant but safe) or just create
    const exact = await this.contactRepository.findByName(userId, name);
    if (exact) {
      return exact;
    }
    return this.contactRepository.create({
      userId,
      name,
    });
  }
}
