import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IContactRepository } from "../../../domain/repositories/IContactRepository";
import { IMessageService } from "../../interfaces/IMessageService";

import { ParsedIntent } from "../../../domain/entities/ParsedData";

const isTransactionIntent = (
  intent: ParsedIntent,
): intent is Extract<ParsedIntent, "CREDIT" | "DEBIT"> =>
  intent === "CREDIT" || intent === "DEBIT";

export class TransactionProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly contactRepository: IContactRepository,
    private readonly messageService: IMessageService,
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
      intent: parsed.intent as "CREDIT" | "DEBIT",
      description: parsed.category,
      userId: context.user.id,
      category: parsed.category,
      contactId: contact?.id,
    });

    let newBalance = 0;
    if (contact) {
      const updatedContact = await this.contactRepository.findById(contact.id);
      if (updatedContact) {
        newBalance = Number(updatedContact.currentBalance);
      }
    }

    const response = `✅ *Entry Added*

${parsed.intent === "CREDIT" ? "🔻 *Gave:*" : "🟩 *Received:*"} ₹${transaction.amount.toFixed(2)}
👤 ${parsed.intent === "CREDIT" ? "To" : "From"}: ${contact ? contact.name : "Unknown"}
📝 *Note:* ${transaction.description || "None"}

💰 *New Balance:* ₹${newBalance.toFixed(2)} ${newBalance < 0 ? "🔴 (Due)" : "🟢 (Credit)"}

_Add more entries or ask for your balance anytime!_`;

    const messageId = await this.messageService.sendMessage({
      to: context.user.phoneNumber!,
      body: response,
    });

    // Link the confirmation message to the transaction
    await this.transactionRepository.updateConfirmationMessageId(
      transaction.id,
      messageId,
    );

    return { response, parsed };
  }

  private async ensureContactExists(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const existing = await this.contactRepository.findByName(userId, name);
    if (existing) {
      return existing;
    }
    return this.contactRepository.create({
      userId,
      name,
    });
  }
}
