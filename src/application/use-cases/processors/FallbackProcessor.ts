import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

// Catch-all for UNKNOWN / social messages (EXPENSE, INCOME, STATUS, UNDO all
// have their own processors). Always last in the pipeline.
export class FallbackProcessor implements MessageProcessor {
  constructor(private readonly messageService: IMessagingPlatform) {}

  canHandle(): boolean {
    return true;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed ?? {
      intent: "UNKNOWN" as const,
      confidence: 0,
    };
    const body =
      parsed.conversational_response ??
      'I didn\'t catch that. Try logging a spend like "chai 30" or "auto 80 office" — or type /help.';
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body,
    });
    return { response: body, parsed };
  }
}
