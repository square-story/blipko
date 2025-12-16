import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../../interfaces/IMessageService";

export class QueryProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "QUERY";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const details = context.parsed?.query_details;
    let responseText = "I couldn't understand your query completely yet.";

    if (details?.type === "TOTAL_SPEND") {
      if (details.period === "THIS_MONTH") {
        // TODO: Implement actual repository method for analytics.
        // For now, this is a placeholder/mock response or we can fetch all and filter.
        responseText =
          "Use /summary to see your daily summary, or check the dashboard for detailed analytics.";
      } else {
        responseText = `I can help you look up ${details.type.toLowerCase().replace("_", " ")}. Check the dashboard for more details!`;
      }
    } else {
      responseText =
        "I can currently only answer basic queries. Try 'Show me today's summary'.";
    }

    await this.messageService.sendMessage({
      to: context.user.phoneNumber!,
      body: responseText,
    });

    return {
      response: responseText,
      parsed: context.parsed!,
    };
  }
}
