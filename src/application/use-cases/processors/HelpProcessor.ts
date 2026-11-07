import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

function helpBody(webAppUrl: string): string {
  return `🧭 *How to use Blipko*

*Log a spend* — just say what you spent, in English, Hindi, Manglish, or Malayalam:
• \`chai 30\`
• \`auto 80 office\`
• \`petrol 500 koduthu\`
Or send a *voice note* — I'll transcribe and log it.

*Ask me anything* about your money:
• "how much did I spend on food this month?"
• "can I afford a 5000 phone?"
• "what's my biggest expense?"

*Commands*
• /status — budget health & safe daily spend
• /report — this month's summary + top spends
• /recurring — repeating income/expenses (rent, salary…)
• /settings — reminder style (off / gentle / aggressive)
• /start — connect your dashboard
• \`undo\` — remove the last entry

*Set up & fine-tune everything* on the web dashboard — sign in, then tap *Connect Telegram* to link this chat. Categories, per-category limits, income split, and reminders all live there: ${webAppUrl}`;
}

// Replies to "help"/"/help" with a detailed guide. Pre-parse (no AI needed).
export class HelpProcessor implements MessageProcessor {
  constructor(
    private readonly messageService: IMessagingPlatform,
    // From env, not hardcoded — the help text used to name blipko.lol
    // literally, so any other deployment sent its users to the wrong app.
    private readonly webAppUrl: string,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "help";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const body = helpBody(this.webAppUrl);
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body,
    });
    return {
      response: body,
      parsed: { intent: "UNKNOWN", confidence: 1 },
    };
  }
}
