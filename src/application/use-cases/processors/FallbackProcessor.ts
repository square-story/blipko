import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { formatMoney } from "../budgetMath";

// Catch-all for intents not yet built in this phase (INCOME/STATUS/UNDO) and for
// UNKNOWN/social messages. Always last in the pipeline.
export class FallbackProcessor implements MessageProcessor {
  constructor(private readonly messageService: IMessagingPlatform) {}

  canHandle(): boolean {
    return true;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed ?? { intent: "UNKNOWN" as const, confidence: 0 };
    const body = this.replyFor(parsed.intent, parsed.amount, parsed.conversational_response);
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body,
    });
    return { response: body, parsed };
  }

  private replyFor(
    intent: string,
    amount?: number,
    conversational?: string,
  ): string {
    switch (intent) {
      case "INCOME":
        return amount && amount > 0
          ? `Noted — income of ${formatMoney(amount)}. (Full income tracking is coming soon.)`
          : "Got it. (Full income tracking is coming soon.)";
      default:
        return (
          conversational ??
          'I didn\'t catch that. Try logging a spend like "chai 30" or "auto 80 office".'
        );
    }
  }
}
