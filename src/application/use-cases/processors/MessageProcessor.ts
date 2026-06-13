import { User } from "@prisma/client";
import { ParsedData } from "../../../domain/entities/ParsedData";
import { ConversationTurn } from "../../../domain/services/IAiParser";

export interface ProcessContext {
  user: User;
  platformUserId: string;
  textMessage: string;
  parsed?: ParsedData | undefined;
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
