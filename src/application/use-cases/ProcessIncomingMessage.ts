import { IAiParser } from "../../domain/services/IAiParser";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IContactRepository } from "../../domain/repositories/IContactRepository";
import { ITransactionRepository } from "../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../interfaces/IMessageService";
import { ParsedData, ParsedIntent } from "../../domain/entities/ParsedData";
import { User, Contact, Transaction } from "@prisma/client";
import { totalBalance } from "../../utils/totalBalance";

interface ProcessIncomingMessageInput {
  senderPhone: string;
  textMessage: string;
  replyToMessageId?: string;
}

interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
}

const QUICK_REPLIES: Record<string, string> = {
  ping: "pong",
  hello: "Hi there! 👋",
  admin: "Sadik is here 💦",
};

const isTransactionIntent = (
  intent: ParsedIntent,
): intent is Extract<ParsedIntent, "CREDIT" | "DEBIT"> =>
  intent === "CREDIT" || intent === "DEBIT";

type TransactionIntent = Extract<ParsedIntent, "CREDIT" | "DEBIT">;
type TransactionParsedData = ParsedData & {
  intent: TransactionIntent;
  amount: number;
};

export class ProcessIncomingMessageUseCase {
  constructor(
    private readonly aiParser: IAiParser,
    private readonly userRepository: IUserRepository,
    private readonly contactRepository: IContactRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) {}

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const normalizedMessage = payload.textMessage.trim().toLowerCase();
    console.log(
      `Executing ProcessIncomingMessage for ${payload.senderPhone} with message: "${normalizedMessage}"`,
    );
    // 1. Identify or Create User
    const user = await this.ensureUserExists(payload.senderPhone);
    console.log(`User identified: ${user.id}`);

    if (normalizedMessage === "start") {
      return this.handleStartIntent(user);
    }

    // 2. Check for Reply Context (Update/Delete)
    if (payload.replyToMessageId) {
      console.log(
        `Processing reply to message ${payload.replyToMessageId} from ${user.id}`,
      );
      const transaction = await this.transactionRepository.findByConfirmationId(
        payload.replyToMessageId,
      );

      if (transaction) {
        console.log(`Found transaction ${transaction.id} for reply.`);
        return this.handleReplyIntent(user, transaction, normalizedMessage);
      } else {
        console.log(
          `No transaction found for confirmation ID ${payload.replyToMessageId}`,
        );
      }
    }

    const quickReply = QUICK_REPLIES[normalizedMessage];
    if (quickReply) {
      return this.handleQuickReply(user, normalizedMessage, quickReply);
    }

    console.log("Parsing message with AI...");
    const parsed = await this.aiParser.parseText(payload.textMessage);
    console.log("AI Parsed result:", JSON.stringify(parsed, null, 2));

    if (parsed.intent === "BALANCE") {
      return this.handleBalanceIntent(user, parsed);
    }

    if (parsed.intent === "UNDO") {
      return this.handleUndoIntent(user, parsed);
    }

    if (isTransactionIntent(parsed.intent)) {
      if (typeof parsed.amount !== "number") {
        throw new Error("Amount is required for CREDIT or DEBIT intents");
      }

      return this.handleTransactionIntent(user, {
        ...parsed,
        amount: parsed.amount,
        intent: parsed.intent,
      });
    }

    throw new Error(`Unsupported intent: ${parsed.intent}`);
  }

  private async handleStartIntent(
    user: User,
  ): Promise<ProcessIncomingMessageOutput> {
    const response = `👋 Hey ${user.name}! Welcome to Blipko! Tell me things like 'Gave 500 to Raju' or ask 'Balance for Raju' to track your ledger.`;

    await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    return {
      response,
      parsed: { intent: "START", notes: "User initiated onboarding" },
    };
  }

  private async handleQuickReply(
    user: User,
    keyword: string,
    response: string,
  ): Promise<ProcessIncomingMessageOutput> {
    await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    return {
      response,
      parsed: {
        intent: "QUICK_REPLY",
        notes: `Quick reply for keyword: ${keyword}`,
      },
    };
  }

  private async handleBalanceIntent(
    user: User,
    parsed: ParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    if (!parsed.name) {
      const response =
        "Please specify a contact name to check balance (e.g., 'Balance for Raju')";
      await this.messageService.sendMessage({
        to: user.phoneNumber!,
        body: response,
      });
      return { response, parsed };
    }

    const contact = await this.contactRepository.findByName(
      user.id,
      parsed.name,
    );

    if (!contact) {
      const response = `You don't have any records with ${parsed.name} yet.`;
      await this.messageService.sendMessage({
        to: user.phoneNumber!,
        body: response,
      });
      return { response, parsed };
    }

    const contactTransactions = await this.transactionRepository.findByContact(
      contact.id,
    );

    const threeTransactions =
      await this.transactionRepository.findThreeTransactions({
        userId: user.id,
        contactId: contact.id,
      });

    const balance = totalBalance(contactTransactions);

    const response = `👤 *Customer Report: ${contact.name}*

💰 *Current Balance:* ₹${balance.toFixed(2)} ${balance < 0 ? "🔴 (Due)" : "🟢 (Credit)"}
📉 *Recent History:*

${threeTransactions
  .map((t) => {
    const type = t.intent === "CREDIT" ? "Gave" : "Received";
    return `- ${type} ₹${t.amount.toFixed(2)} on ${t.date.toISOString().split("T")[0]}${t.description ? ` (${t.description})` : ""}`;
  })
  .join("\n\n")}

_Reply with "Statement ${contact.name}" for full PDF._
`;
    await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    return { response, parsed };
  }

  private async handleTransactionIntent(
    user: User,
    parsed: TransactionParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    let contact: Contact | null = null;

    if (parsed.name) {
      contact = await this.ensureContactExists(user.id, parsed.name);
    }

    console.log(
      `Creating transaction for user ${user.id}, contact ${contact?.id}, amount ${parsed.amount}, intent ${parsed.intent}`,
    );
    const transaction = await this.transactionRepository.create({
      amount: parsed.amount,
      intent: parsed.intent,
      description: parsed.category,
      userId: user.id,
      category: parsed.category,
      contactId: contact?.id,
    });

    const newBalance = totalBalance(
      (contact &&
        (await this.transactionRepository.findByContact(contact?.id))) ||
        [],
    );

    const response = `✅ *Entry Added*

${parsed.intent === "CREDIT" ? "🔻 *Gave:*" : "🟩 *Received:*"} ₹${transaction.amount.toFixed(2)}
👤 ${parsed.intent === "CREDIT" ? "To" : "From"}: ${contact ? contact.name : "Unknown"}
📝 *Note:* ${transaction.description || "None"}

💰 *New Balance:* ₹${newBalance.toFixed(2)} ${newBalance < 0 ? "🔴 (Due)" : "🟢 (Credit)"}

_Add more entries or ask for your balance anytime!_`;

    const messageId = await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    // Link the confirmation message to the transaction
    await this.transactionRepository.updateConfirmationMessageId(
      transaction.id,
      messageId,
    );

    return { response, parsed };
  }

  private async ensureUserExists(phoneNumber: string): Promise<User> {
    const existing = await this.userRepository.findByPhone(phoneNumber);
    if (existing) {
      console.log(`Found existing user for phone ${phoneNumber}`);
      return existing;
    }
    console.log(`Creating new user for phone ${phoneNumber}`);

    return this.userRepository.create({
      phoneNumber: phoneNumber,
    });
  }

  private async ensureContactExists(
    userId: string,
    name: string,
  ): Promise<Contact> {
    const existing = await this.contactRepository.findByName(userId, name);
    if (existing) {
      console.log(`Found existing contact ${name} for user ${userId}`);
      return existing;
    }
    console.log(`Creating new contact ${name} for user ${userId}`);

    return this.contactRepository.create({
      userId,
      name,
    });
  }

  private async handleUndoIntent(
    user: User,
    parsed: ParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    const deletedTransaction =
      await this.transactionRepository.deleteLastTransaction(user.id);

    if (!deletedTransaction) {
      const response = "⚠️ No recent transaction found to delete.";
      await this.messageService.sendMessage({
        to: user.phoneNumber!,
        body: response,
      });
      return { response, parsed };
    }

    // Recalculate balance for the contact involved in the deleted transaction
    let newBalance = 0;
    if (deletedTransaction.contactId) {
      const contactTransactions =
        await this.transactionRepository.findByContact(
          deletedTransaction.contactId,
        );
      newBalance = totalBalance(contactTransactions);
    }

    const response = `🗑️ *Deleted Last Entry*

Removed: ₹${Number(deletedTransaction.amount).toFixed(2)} (${deletedTransaction.intent})
    
🔄 Balance reverted to previous state.`;

    await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    return { response, parsed };
  }

  private async handleReplyIntent(
    user: User,
    transaction: Transaction,
    message: string,
  ): Promise<ProcessIncomingMessageOutput> {
    const lowerMessage = message.toLowerCase();

    // DELETE Intent
    if (
      lowerMessage.includes("delete") ||
      lowerMessage.includes("remove") ||
      lowerMessage.includes("undo")
    ) {
      await this.transactionRepository.delete(transaction.id);
      const response = `🗑️ *Entry Deleted*
      
Removed: ₹${Number(transaction.amount).toFixed(2)} (${transaction.intent})
Note: ${transaction.description}`;

      await this.messageService.sendMessage({
        to: user.phoneNumber!,
        body: response,
      });

      return {
        response,
        parsed: { intent: "UNDO", notes: "Deleted via reply" },
      };
    }

    // UPDATE Intent (Category)
    if (lowerMessage.includes("update category to")) {
      const newCategory = message.split("update category to")[1]?.trim();
      if (newCategory) {
        await this.transactionRepository.update(transaction.id, {
          category: newCategory,
          description: newCategory, // Updating description as well for now as they are often mapped
        });

        const response = `✅ *Category Updated*
        
New Category: ${newCategory}`;

        await this.messageService.sendMessage({
          to: user.phoneNumber!,
          body: response,
        });

        return {
          response,
          parsed: {
            intent: "START", // Using START as a generic intent for now
            notes: `Updated category to ${newCategory}`,
          },
        };
      }
    }

    // Default: Unknown reply intent
    const response =
      "❓ I see you replied to a transaction, but I didn't understand. Try 'delete' or 'update category to [name]'.";
    await this.messageService.sendMessage({
      to: user.phoneNumber!,
      body: response,
    });

    return {
      response,
      parsed: { intent: "START", notes: "Unknown reply intent" },
    };
  }
}
