export type ParsedIntent =
  | "PAID"
  | "RECEIVED"
  | "BALANCE"
  | "START"
  | "QUICK_REPLY"
  | "UNDO"
  | "CHAT"
  | "QUERY"
  | "UPDATE_TRANSACTION"
  | "VIEW_DAILY_SUMMARY"
  | "WALLET"
  | "SET_RECURRING";

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
      | "TRANSACTION_HISTORY"
      | "CONTACT_BALANCE"
      | "UNPAID_CONTACTS"
      | "OVERDUE_DUES";
    period?: "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL_TIME";
    category?: string;
    contactName?: string; // for CONTACT_BALANCE queries
  };
  updatedFields?: {
    amount?: number;
    category?: string;
    description?: string;
    name?: string;
  };
  wallet_action?: {
    action: "SHOW_BALANCE" | "SWITCH" | "LIST" | "CREATE";
    walletName?: string;
  };
  recurring_details?: {
    description: string;
    amount: number;
    amountMin?: number;
    amountMax?: number;
    direction: "INCOME" | "EXPENSE";
    dayOfMonth: number;
    period: "MONTHLY" | "QUARTERLY";
    walletName?: string;
  };
}
