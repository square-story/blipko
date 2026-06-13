import { ConversationTurn } from "./IAiParser";

// Context the query agent needs to ground its answer. The agent itself is
// read-only: it calls IFinancialDataTools to fetch real numbers and composes a
// natural-language reply. It never writes/edits/deletes.
export interface QueryAgentContext {
  userId: string;
  currency: string;
  locale: string;
  payday: number;
  monthlyIncome: number; // expected salary (a floor); actual income may exceed it
  now: Date;
  period: {
    start: string; // ISO
    end: string; // ISO (exclusive)
    day: number;
    daysInPeriod: number;
    remainingDays: number;
  };
  history?: ConversationTurn[] | undefined;
}

export interface IFinancialQueryAgent {
  // Returns a Telegram-Markdown answer. Throws on provider/loop failure so the
  // caller can degrade to a friendly fallback.
  answer(question: string, ctx: QueryAgentContext): Promise<string>;
}
