import { MessageProcessor, ProcessContext, ProcessOutput } from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../../interfaces/IMessageService";
import { totalBalance } from "../../../utils/totalBalance";

export class UndoProcessor implements MessageProcessor {
    constructor(
        private readonly transactionRepository: ITransactionRepository,
        private readonly messageService: IMessageService,
    ) { }

    canHandle(context: ProcessContext): boolean {
        return context.parsed?.intent === "UNDO";
    }

    async process(context: ProcessContext): Promise<ProcessOutput> {
        const deletedTransaction =
            await this.transactionRepository.deleteLastTransaction(context.user.id);

        if (!deletedTransaction) {
            const response = "⚠️ No recent transaction found to delete.";
            await this.messageService.sendMessage({
                to: context.user.phoneNumber!,
                body: response,
            });
            return { response: response, parsed: context.parsed! };
        }

        const response = `🗑️ *Deleted Last Entry*

Removed: ₹${Number(deletedTransaction.amount).toFixed(2)} (${deletedTransaction.intent})
    
🔄 Balance reverted to previous state.`;

        await this.messageService.sendMessage({
            to: context.user.phoneNumber!,
            body: response,
        });

        return { response, parsed: context.parsed! };
    }
}
