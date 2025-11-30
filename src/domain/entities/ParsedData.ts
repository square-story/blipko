export type ParsedIntent =
  | "CREDIT"
  | "DEBIT"
  | "BALANCE"
  | "START"
  | "QUICK_REPLY"
  | "UNDO";

export interface ParsedData {
  intent: ParsedIntent;
  amount?: number;
  name?: string;
  notes?: string;
  category?: string;
  currency?: string;
}
