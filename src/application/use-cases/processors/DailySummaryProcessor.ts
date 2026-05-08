import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

export class DailySummaryProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "VIEW_DAILY_SUMMARY";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const summary = await this.transactionRepository.getDailySummary(
      context.user.id,
      new Date(),
    );

    let response = `📅 *Today's Summary*\n\n`;
    response += `💸 *Total Spend:* ₹${summary.totalSpend}\n\n`;

    if (Object.keys(summary.categoryBreakdown).length > 0) {
      response += `📊 *Category Breakdown:*\n`;
      for (const [category, amount] of Object.entries(
        summary.categoryBreakdown,
      )) {
        response += `- ${category}: ₹${amount}\n`;
      }
      response += `\n`;
    }

    if (summary.transactions.length > 0) {
      response += `📝 *Recent Entries:*\n`;
      summary.transactions.slice(0, 5).forEach((tx) => {
        const icon = tx.intent === "CREDIT" ? "🔴" : "🟢";
        response += `${icon} ₹${tx.amount} (${tx.category || "General"})\n`;
      });
    } else {
      response += `_No transactions recorded today._`;
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });

    return { response, parsed: context.parsed! };
  }
}
