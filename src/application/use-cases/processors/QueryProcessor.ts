import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { ConversationTurn } from "../../../domain/services/IAiParser";

export interface IQueryAgent {
  resolve(
    userId: string,
    text: string,
    history: ConversationTurn[],
  ): Promise<string>;
}

export class QueryProcessor implements MessageProcessor {
  constructor(
    private readonly queryAgent: IQueryAgent | null,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "QUERY";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    let response: string;

    if (this.queryAgent) {
      const history = context.conversationHistory ?? [];
      response = await this.queryAgent.resolve(
        context.user.id,
        context.textMessage,
        history,
      );
    } else {
      response =
        "Use the dashboard for detailed analytics. I can answer: contact balance, who hasn't paid, total spend/income.";
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });

    return { response, parsed: context.parsed! };
  }
}
