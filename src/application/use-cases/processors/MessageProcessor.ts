import { User } from "@prisma/client";
import { ParsedData, ParsedBatch } from "../../../domain/entities/ParsedData";
import { ConversationTurn } from "../../../domain/services/IAiParser";

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
  conversationHistory?: ConversationTurn[] | undefined;
}

export interface ProcessOutput {
  response: string;
  parsed: ParsedData;
}

export interface MessageProcessor {
  canHandle(context: ProcessContext): boolean;
  process(context: ProcessContext): Promise<ProcessOutput>;
}
