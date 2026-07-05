import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";

const UNKNOWN = { intent: "UNKNOWN" as const, confidence: 1 };

// The web dashboard owns onboarding + identity; Telegram is a linked channel.
// This builds the hand-off shown to anyone who hasn't finished web setup +
// linking. Shared with ProcessIncomingMessage's brand-new-user short-circuit so
// the message is identical everywhere.
export function buildConnectHandoff(webAppUrl: string): {
  body: string;
  rows: InlineButtonRows;
} {
  const body = `👋 *Welcome to Blipko!*

I track your spending straight from chat — but let's get you set up first (takes a minute):

1️⃣ Open your dashboard & sign in
2️⃣ Set your income & pick categories
3️⃣ Tap *Connect Telegram*

Then just text me what you spend — like \`chai 30\` — and I'll do the rest.`;
  const rows: InlineButtonRows = [
    [{ id: "connect", title: "🔗 Open dashboard", url: webAppUrl }],
  ];
  return { body, rows };
}

// Replaces the old in-chat onboarding wizard: a user who hasn't completed web
// onboarding (or types /start) is handed off to the dashboard. Runs pre-parse.
export class ConnectAccountProcessor implements MessageProcessor {
  constructor(
    private readonly messageService: IMessagingPlatform,
    private readonly webAppUrl: string,
  ) {}

  canHandle(context: ProcessContext): boolean {
    if (!context.user.hasOnboarded) return true;
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "start";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;

    // Onboarded user who typed /start → friendly welcome-back.
    if (user.hasOnboarded) {
      const body = `👋 Welcome back! Just text me what you spend — like "chai 30" or "auto 80". Type /help anytime.`;
      await this.messageService.sendMessage({ to: platformUserId, body });
      return { response: body, parsed: UNKNOWN };
    }

    const { body, rows } = buildConnectHandoff(this.webAppUrl);
    await this.messageService.sendInteractiveMessage(
      platformUserId,
      body,
      rows,
    );
    return { response: body, parsed: UNKNOWN };
  }
}
