export type ParsedIntent =
  | "CREDIT"
  | "DEBIT"
  | "BALANCE"
  | "START"
  | "QUICK_REPLY"
  | "UNDO"
  | "CHAT"
  | "QUERY"
  | "UPDATE_TRANSACTION";

export interface ParsedData {
  intent: ParsedIntent;
  amount?: number;
  name?: string;
  notes?: string;
  category?: string;
  description?: string;
  currency?: string;
  conversational_response?: string;
  query_details?: {
    type?:
      | "TOTAL_SPEND"
      | "TOTAL_INCOME"
      | "NET_BALANCE"
      | "TRANSACTION_HISTORY";
    period?: "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL_TIME";
    category?: string;
  };
  updatedFields?: {
    amount?: number;
    category?: string;
    description?: string;
    name?: string;
  };
}
