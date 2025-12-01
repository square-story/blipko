import { MessageProcessor } from "./MessageProcessor";
import {
    ProcessIncomingMessageInput,
    ProcessIncomingMessageOutput,
} from "../ProcessIncomingMessage";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../../interfaces/IMessageService";

export class DailySummaryProcessor implements MessageProcessor {
    constructor(
        private readonly transactionRepository: ITransactionRepository,
        private readonly messageService: IMessageService,
    ) { }

    canHandle(context: any): boolean {
        return context.parsed?.intent === "VIEW_DAILY_SUMMARY";
    }

    async process(
        context: ProcessIncomingMessageInput & { parsed: any; user: any },
    ): Promise<ProcessIncomingMessageOutput> {
        const { user, parsed } = context;

        const summary = await this.transactionRepository.getDailySummary(
            user.id,
            new Date(),
        );

        let response = `📅 *Today's Summary*\n\n`;
        response += `💸 *Total Spend:* ₹${summary.totalSpend}\n\n`;

        if (Object.keys(summary.categoryBreakdown).length > 0) {
            response += `📊 *Category Breakdown:*\n`;
            for (const [category, amount] of Object.entries(summary.categoryBreakdown)) {
                response += `- ${category}: ₹${amount}\n`;
            }
            response += `\n`;
        }

        if (summary.transactions.length > 0) {
            response += `📝 *Recent Entries:*\n`;
            // Show last 5 transactions
            summary.transactions.slice(0, 5).forEach((tx) => {
                const icon = tx.intent === "CREDIT" ? "🔴" : "🟢";
                response += `${icon} ₹${tx.amount} (${tx.category || "General"})\n`;
            });
        } else {
            response += `_No transactions recorded today._`;
        }

        await this.messageService.sendMessage({
            to: user.phoneNumber!,
            body: response,
        });

        return {
            response,
            parsed,
        };
    }
}
