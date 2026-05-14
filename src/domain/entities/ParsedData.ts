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
  | "SET_RECURRING"
  | "GROUP_SETUP";

export interface ParsedData {
  intent: ParsedIntent;
  amount?: number;
  name?: string;
  notes?: string;
  category?: string;
  description?: string;
  currency?: string;
  conversational_response?: string;
  // Multi-person: populated when >1 participant in one message
  participants?: Array<{ name: string; amount: number }>;
  query_details?: {
    type?:
      | "TOTAL_SPEND"
      | "TOTAL_INCOME"
      | "NET_BALANCE"
      | "TRANSACTION_HISTORY"
      | "CONTACT_BALANCE"
      | "UNPAID_CONTACTS"
      | "OVERDUE_DUES"
      | "GROUP_SUMMARY"
      | "MEMBER_SPEND";
    // ISO date strings replacing the period enum — AI calculates these from natural language
    from_date?: string; // YYYY-MM-DD
    to_date?: string; // YYYY-MM-DD
    category?: string;
    contactName?: string;
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
  group_action?: {
    action: "CREATE" | "JOIN";
    code?: string;
  };
}
