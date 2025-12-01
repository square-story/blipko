export type ParsedIntent =
  | "CREDIT"
  | "DEBIT"
  | "BALANCE"
  | "START"
  | "QUICK_REPLY"
  | "UNDO"
  | "VIEW_DAILY_SUMMARY"
  | "UPDATE_TRANSACTION";

export interface ParsedData {
  intent: ParsedIntent;
  amount?: number;
  name?: string;
  notes?: string;
  category?: string;
  currency?: string;
  updatedFields?: {
    amount?: number;
    category?: string;
    description?: string;
    name?: string;
  };
}
