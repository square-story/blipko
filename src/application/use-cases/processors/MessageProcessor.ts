import { IncomeCategory, User } from "@prisma/client";
import { ParsedData, ParsedBatch } from "../../../domain/entities/ParsedData";
import { ConversationTurn } from "../../../domain/services/IAiParser";
import { TransactionRef } from "../transactionActions";
import { TurnMeta } from "../../../domain/repositories/IConversationRepository";

export interface ProcessContext {
  user: User;
  platformUserId: string;
  textMessage: string;
  parsed?: ParsedData | undefined;
  // Set only when a message parsed into multiple transactions (>= 2).
  // BatchProcessor handles it; single-transaction paths use `parsed`.
  parsedBatch?: ParsedBatch | undefined;
  replyToMessageId?: string | undefined;
  callbackMessageId?: string | undefined;
  // The callback_query id (button press) — lets a handler ack with a toast.
  callbackQueryId?: string | undefined;
  // Resolved when the user replied to a transaction confirmation — the reply/edit
  // processors gate on this (canHandle can't do async lookups).
  replyTarget?: TransactionRef | undefined;
  conversationHistory?: ConversationTurn[] | undefined;
  // The user's income taxonomy, loaded once for the parser prompt and reused by
  // IncomeProcessor to resolve the name the parser picked. Unset on the pre-parse
  // path, where nothing needs it.
  incomeCategories?: IncomeCategory[] | undefined;
}

export interface ProcessOutput {
  response: string;
  parsed: ParsedData;
  // Optional short toast shown on the tapped inline button.
  toast?: string | undefined;
  // Extra detail to persist with this turn (tool trace, model, latency, cost).
  // Set by the assistant lane; deterministic processors leave it unset.
  turnMeta?: TurnMeta | undefined;
  // Short stand-in stored in the transcript instead of `response`. For replies
  // that are a pure rendering of data the AI can fetch on demand (/status,
  // /report), the full text is a money dump with no follow-up value — and it
  // would otherwise be replayed into the parser's prompt on every later message.
  historyText?: string | undefined;
}

export interface MessageProcessor {
  canHandle(context: ProcessContext): boolean;
  process(context: ProcessContext): Promise<ProcessOutput>;
}
