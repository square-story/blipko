import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

const HELP_BODY = `🧭 *How to use Blipko*

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
• /report — this month's summary + top leaks
• /recurring — repeating income/expenses (rent, salary…)
• /settings — reminder style (off / gentle / aggressive)
• /start — connect your dashboard
• \`undo\` — remove the last entry

*Set up & fine-tune everything* on the web dashboard — sign in, then tap *Connect Telegram* to link this chat. Categories, per-category limits, income split, and reminders all live there: blipko.lol`;

// Replies to "help"/"/help" with a detailed guide. Pre-parse (no AI needed).
export class HelpProcessor implements MessageProcessor {
  constructor(private readonly messageService: IMessagingPlatform) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "help";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: HELP_BODY,
    });
    return {
      response: HELP_BODY,
      parsed: { intent: "UNKNOWN", confidence: 1 },
    };
  }
}
