import { Transaction } from "@prisma/client";
import { ParsedData } from "../entities/ParsedData";

export interface ConversationTurn {
  role: "user" | "model";
  content: string;
}

export interface IAiParser {
  parseText(
    text: string,
    replyTransaction?: Transaction | null,
    history?: ConversationTurn[],
  ): Promise<ParsedData>;
}
