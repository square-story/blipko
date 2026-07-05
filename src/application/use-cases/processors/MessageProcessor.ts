import { User } from "@prisma/client";
import { ParsedData, ParsedBatch } from "../../../domain/entities/ParsedData";
import { ConversationTurn } from "../../../domain/services/IAiParser";
import { TransactionRef } from "../transactionActions";

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
}

export interface ProcessOutput {
  response: string;
  parsed: ParsedData;
  // Optional short toast shown on the tapped inline button.
  toast?: string | undefined;
}

export interface MessageProcessor {
  canHandle(context: ProcessContext): boolean;
  process(context: ProcessContext): Promise<ProcessOutput>;
}
