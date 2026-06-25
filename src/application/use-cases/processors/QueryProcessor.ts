import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IFinancialQueryAgent } from "../../../domain/services/IFinancialQueryAgent";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { currentBudgetPeriod, periodDayInfo } from "../budgetMath";
import { withTimeout } from "../../../utils/withTimeout";
import { logger } from "../../../utils/logger";

const FALLBACK =
  "I couldn't work that out right now — try /status, or rephrase your question.";

// Upper bound on the tool-calling agent so a hung OpenAI call can't block the webhook.
const QUERY_TIMEOUT_MS = 15_000;

// Handles the QUERY intent: free-form questions about the user's spending,
// income, or budget. Delegates to a read-only tool-calling agent that fetches
// real figures and composes the answer. On any agent failure it degrades to a
// friendly nudge rather than crashing the webhook.
export class QueryProcessor implements MessageProcessor {
  constructor(
    private readonly queryAgent: IFinancialQueryAgent,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "QUERY";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage } = context;
    const now = new Date();
    const { start, end } = currentBudgetPeriod(user.payday, now);
    const { day, daysInPeriod, remainingDays } = periodDayInfo(
      user.payday,
      now,
    );

    let body: string;
    try {
      body = await withTimeout(
        this.queryAgent.answer(textMessage, {
          userId: user.id,
          currency: user.currency,
          locale: user.locale,
          payday: user.payday,
          monthlyIncome: Number(user.monthlyIncome ?? 0),
          now,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
            day,
            daysInPeriod,
            remainingDays,
          },
          history: context.conversationHistory,
        }),
        QUERY_TIMEOUT_MS,
        "query agent",
      );
    } catch (error) {
      logger.error("Query agent failed", {
        component: "query",
        userId: user.id,
        question: textMessage,
        err: error,
      });
      body = FALLBACK;
    }

    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "QUERY", confidence: 1 } };
  }
}
