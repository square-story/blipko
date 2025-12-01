import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../../interfaces/IMessageService";

export class ReplyProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) {}

  canHandle(context: ProcessContext): boolean {
    // 1. If AI explicitly says UPDATE_TRANSACTION, we handle it (regardless of replyTransaction).
    if (context.parsed?.intent === "UPDATE_TRANSACTION") {
      return true;
    }

    // 2. If no AI parsing yet (first loop):
    //    We only handle if there IS a reply transaction AND it matches simple patterns.
    if (
      !context.parsed &&
      context.replyTransaction &&
      !this.isConfirmationReply(context)
    ) {
      const lower = context.textMessage.toLowerCase();
      if (
        lower.includes("delete") ||
        lower.includes("remove") ||
        lower.includes("undo")
      )
        return true;
      if (lower.includes("update category to")) return true;
    }

    return false;
  }

  private isConfirmationReply(_context: ProcessContext): boolean {
    // Check if the reply is a button click (which we'll handle in ConfirmationProcessor)
    // For now, we assume simple text replies are handled here
    // Button clicks usually come with specific payloads or IDs, but here we deal with text
    // If the user types "delete", we handle it here.
    return false;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    let transaction = context.replyTransaction;

    // Fallback: If no reply transaction but intent is UPDATE, fetch last transaction
    if (!transaction && context.parsed?.intent === "UPDATE_TRANSACTION") {
      const lastTx = await this.transactionRepository.findLastByUserId(
        context.user.id,
      );
      if (lastTx) {
        transaction = lastTx;
      } else {
        return {
          response:
            "I couldn't find any recent transaction to update. Please create a new transaction first.",
          parsed: context.parsed,
        };
      }
    }

    if (!transaction) {
      return {
        response:
          "Please reply to the specific transaction you want to update.",
        parsed: context.parsed || { intent: "START" },
      };
    }

    const lowerMessage = context.textMessage.toLowerCase();

    // DELETE Intent
    if (
      lowerMessage.includes("delete") ||
      lowerMessage.includes("remove") ||
      lowerMessage.includes("undo")
    ) {
      // Ask for confirmation using buttons
      const response = `⚠️ Are you sure you want to delete this transaction?
      
₹${Number(transaction.amount).toFixed(2)} (${transaction.intent})`;

      await this.messageService.sendInteractiveMessage(
        context.user.phoneNumber!,
        response,
        [
          { id: `confirm_delete_${transaction.id}`, title: "Delete" },
          { id: `cancel_delete_${transaction.id}`, title: "Cancel" },
        ],
      );

      return {
        response,
        parsed: { intent: "UNDO", notes: "Requested delete confirmation" },
      };
    }

    // UPDATE Intent (AI Parsed)
    if (context.parsed?.intent === "UPDATE_TRANSACTION") {
      const updates = context.parsed.updatedFields;
      if (updates && Object.keys(updates).length > 0) {
        // Ensure description is updated if category is updated (and description isn't explicitly provided)
        if (updates.category && !updates.description) {
          updates.description = updates.category;
        }

        await this.transactionRepository.update(transaction.id, updates);

        let updateMsg = "✅ *Transaction Updated*\n";
        if (updates.amount) updateMsg += `Amount: ${updates.amount}\n`;
        if (updates.category) updateMsg += `Category: ${updates.category}\n`;
        if (updates.description)
          updateMsg += `Description: ${updates.description}\n`;
        if (updates.name) updateMsg += `Name: ${updates.name}\n`;

        await this.messageService.sendMessage({
          to: context.user.phoneNumber!,
          body: updateMsg,
        });

        return {
          response: updateMsg,
          parsed: context.parsed,
        };
      }
    }

    // Legacy/Fallback UPDATE Intent (Category) - Keep for safety or specific patterns if AI fails
    if (lowerMessage.includes("update category to")) {
      const newCategory = context.textMessage
        .split("update category to")[1]
        ?.trim();
      if (newCategory) {
        await this.transactionRepository.update(transaction.id, {
          category: newCategory,
        });

        const response = `✅ *Category Updated*
        
New Category: ${newCategory}`;

        await this.messageService.sendMessage({
          to: context.user.phoneNumber!,
          body: response,
        });

        return {
          response,
          parsed: {
            intent: "UPDATE_TRANSACTION",
            notes: `Updated category to ${newCategory}`,
            updatedFields: { category: newCategory },
          },
        };
      }
    }

    // Default: Unknown reply intent
    const response =
      "❓ I see you replied to a transaction, but I didn't understand. Try 'delete' or 'update category to [name]'.";
    await this.messageService.sendMessage({
      to: context.user.phoneNumber!,
      body: response,
    });

    return {
      response,
      parsed: { intent: "START", notes: "Unknown reply intent" },
    };
  }
}
