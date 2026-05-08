import { User, Transaction } from "@prisma/client";
import { ParsedData } from "../../../domain/entities/ParsedData";

export interface ProcessContext {
  user: User;
  platformUserId: string;
  textMessage: string;
  parsed?: ParsedData | undefined;
  replyToMessageId?: string | undefined;
  replyTransaction?: Transaction | undefined;
  walletId?: string | undefined;
  walletName?: string | undefined;
}

export interface ProcessOutput {
  response: string;
  parsed: ParsedData;
}

export interface MessageProcessor {
  canHandle(context: ProcessContext): boolean;
  process(context: ProcessContext): Promise<ProcessOutput>;
}
