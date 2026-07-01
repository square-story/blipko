import { ParsedBatch, ParsedBucket } from "../entities/ParsedData";

export interface ConversationTurn {
  role: "user" | "model";
  content: string;
}

// The user's category list, fed to the parser so it maps spends onto existing
// categories/buckets instead of inventing new ones.
export interface CategoryHint {
  name: string;
  bucket: ParsedBucket;
}

export interface ParseContext {
  categories: CategoryHint[];
  history?: ConversationTurn[];
}

export interface IAiParser {
  parseText(text: string, ctx: ParseContext): Promise<ParsedBatch>;
}
