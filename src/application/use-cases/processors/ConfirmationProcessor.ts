import { MessageProcessor, ProcessContext, ProcessOutput } from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../../interfaces/IMessageService";

export class ConfirmationProcessor implements MessageProcessor {
    constructor(
        private readonly transactionRepository: ITransactionRepository,
        private readonly messageService: IMessageService,
    ) { }

    canHandle(context: ProcessContext): boolean {
        // This processor handles button clicks which come as text messages but with specific IDs in a real scenario.
        // However, since we are receiving "textMessage", we might need to rely on the content if the webhook doesn't send the ID as text.
        // BUT, for this specific implementation, let's assume the webhook controller passes the button ID as the message or we parse it.
        // Wait, the `ProcessIncomingMessageInput` has `textMessage`.
        // If the user clicks a button, WhatsApp sends a specific payload. The WebhookController should extract it.
        // Let's assume for now that `textMessage` might contain the button ID if it's a button reply, OR we need to handle it in the controller.
        // Given the current scope, let's assume the `textMessage` IS the button title or ID if we map it.
        // Actually, usually button replies come as a separate type.
        // If the user clicks "Delete", the text message received is "Delete".
        // But we need the ID to know WHICH transaction.
        // The `replyToMessageId` will be the ID of the confirmation message (the one with buttons).
        // So if we find a transaction associated with the confirmation message, AND the text is "Delete" or "Cancel", we can handle it.

        // However, we need to know if it was a CONFIRMATION request.
        // The `replyTransaction` is found via `findByConfirmationId`.
        // If we sent a confirmation message, we should have stored its ID?
        // Wait, `updateConfirmationMessageId` stores the ID of the "Entry Added" message.
        // When we ask "Are you sure?", that's a NEW message.
        // We need to track THAT message ID too if we want to handle the reply to IT.

        // Strategy:
        // 1. User replies "delete" to "Entry Added". -> ReplyProcessor handles it, sends "Are you sure?" with buttons.
        // 2. User clicks "Delete" on "Are you sure?". -> This is a reply to "Are you sure?".
        // We need to store the "Are you sure?" message ID? Or encode the transaction ID in the button payload?
        // If it's a button payload, the webhook controller needs to pass it.

        // Let's assume the `textMessage` passed here is the button ID (e.g., "confirm_delete_123") if the controller handles it.
        // OR, if the controller passes the button title "Delete", we need context.

        // Let's look at `ProcessIncomingMessageInput`. It has `textMessage`.
        // If the user clicks a button, the webhook receives type="interactive".
        // The controller should probably extract the `button_reply.id` and pass it as `textMessage` or a new field.
        // Let's assume `textMessage` contains the ID for now to keep it simple, or we check for the pattern.

        return context.textMessage.startsWith("confirm_delete_") || context.textMessage.startsWith("cancel_delete_");
    }

    async process(context: ProcessContext): Promise<ProcessOutput> {
        const action = context.textMessage.startsWith("confirm_delete_") ? "confirm" : "cancel";
        const transactionId = context.textMessage.replace("confirm_delete_", "").replace("cancel_delete_", "");

        if (action === "confirm") {
            const transaction = await this.transactionRepository.findById(transactionId);
            if (transaction) {
                await this.transactionRepository.delete(transactionId);
                const response = `🗑️ *Entry Deleted*
      
Removed: ₹${Number(transaction.amount).toFixed(2)} (${transaction.intent})
Note: ${transaction.description}`;

                await this.messageService.sendMessage({
                    to: context.user.phoneNumber!,
                    body: response,
                });

                return {
                    response,
                    parsed: { intent: "UNDO", notes: "Confirmed delete" },
                };
            } else {
                const response = "⚠️ Transaction not found or already deleted.";
                await this.messageService.sendMessage({
                    to: context.user.phoneNumber!,
                    body: response,
                });
                return { response, parsed: { intent: "UNDO", notes: "Transaction not found" } };
            }
        } else {
            const response = "❌ Deletion cancelled.";
            await this.messageService.sendMessage({
                to: context.user.phoneNumber!,
                body: response,
            });
            return {
                response,
                parsed: { intent: "UNDO", notes: "Cancelled delete" },
            };
        }
    }
}
