import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { bucketBudget, formatMoney } from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const MAX_INCOME = 100_000_000;

// Matches a pure number (optionally ₹-prefixed, with grouping commas/decimals).
const PURE_NUMBER_RE = /^\s*₹?\s*([\d,]+(?:\.\d+)?)\s*$/;

// Drives first-run onboarding: greet → capture monthly income → create
// BudgetConfig → show the 50/30/20 split. Runs before AI parsing.
export class OnboardingProcessor implements MessageProcessor {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage.trim().toLowerCase();
    const isStart = normalized === "start" || normalized === "/start";
    return isStart || !context.user.hasOnboarded;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage } = context;

    // Already onboarded and just typed /start → friendly welcome-back.
    if (user.hasOnboarded) {
      return this.reply(
        platformUserId,
        `👋 Welcome back! Just text me what you spend — like "chai 30" or "auto 80". Type /help anytime.`,
      );
    }

    // Awaiting income: a pure number captures it.
    const match = textMessage.match(PURE_NUMBER_RE);
    if (match && match[1]) {
      const income = Number(match[1].replace(/,/g, ""));
      if (income > 0 && income <= MAX_INCOME) {
        return this.onboard(user.id, platformUserId, income);
      }
    }

    // No income yet (start command, or a non-numeric first message) → ask.
    return this.reply(
      platformUserId,
      `👋 Welcome! I help you track spending and stay on budget.\n\nWhat's your monthly income? (just send the number, e.g. 50000)`,
    );
  }

  private async onboard(
    userId: string,
    platformUserId: string,
    income: number,
  ): Promise<ProcessOutput> {
    await this.userRepository.update(userId, {
      monthlyIncome: income,
      hasOnboarded: true,
    });
    await this.budgetConfigRepository.create({ userId });

    const needs = bucketBudget(income, DEFAULT_SPLIT, "NEEDS");
    const wants = bucketBudget(income, DEFAULT_SPLIT, "WANTS");
    const savings = bucketBudget(income, DEFAULT_SPLIT, "SAVINGS");

    const body = `Got it. Here's your monthly plan (50/30/20):
🏠 Needs    ${formatMoney(needs)}
🎯 Wants    ${formatMoney(wants)}
💰 Savings  ${formatMoney(savings)}

Just text me what you spend — like "chai 30" or "auto 80".
You can also send a voice note. Type /help anytime.`;

    return this.reply(platformUserId, body);
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return {
      response: body,
      parsed: { intent: "UNKNOWN", confidence: 1 },
    };
  }
}
