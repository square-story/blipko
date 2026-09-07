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
  // Income category names. A plain list, not CategoryHint[]: income has no
  // bucket, and the 50/30/20 split is a property of spending only.
  incomeCategories: string[];
  history?: ConversationTurn[];
  // "YYYY-MM-DD" in the USER'S timezone. Passed in rather than derived inside
  // the parser: a server-side UTC date tells an IST user it is yesterday every
  // evening after 18:30, which silently misdates "spent 200 today".
  today: string;
  // True when the assistant lane is on. The parser then has one job — log or
  // escalate — instead of classifying eight intents it can get wrong.
  assistantMode?: boolean | undefined;
}

export interface IAiParser {
  parseText(text: string, ctx: ParseContext): Promise<ParsedBatch>;
}
