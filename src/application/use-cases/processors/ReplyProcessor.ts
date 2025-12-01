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
    return !!context.replyTransaction && !this.isConfirmationReply(context);
  }

  private isConfirmationReply(_context: ProcessContext): boolean {
    // Check if the reply is a button click (which we'll handle in ConfirmationProcessor)
    // For now, we assume simple text replies are handled here
    // Button clicks usually come with specific payloads or IDs, but here we deal with text
    // If the user types "delete", we handle it here.
    return false;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const transaction = context.replyTransaction!;
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

    // UPDATE Intent (Category)
    if (lowerMessage.includes("update category to")) {
      const newCategory = context.textMessage
        .split("update category to")[1]
        ?.trim();
      if (newCategory) {
        await this.transactionRepository.update(transaction.id, {
          category: newCategory,
          description: newCategory,
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
            intent: "START",
            notes: `Updated category to ${newCategory}`,
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
