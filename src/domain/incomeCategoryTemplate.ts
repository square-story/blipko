// The system income taxonomy, seeded with userId = null (same pattern as
// CATEGORY_TEMPLATE). Fed to the parser so it maps incoming money onto a real
// category instead of inventing one, and read by sumEarnedForMonth.
//
// countsAsEarnings is what the budget math cares about. "false" means the money
// is not new income — a refund, a friend settling up, a loan — and must not widen
// the budget, because the expense it offsets already consumed budget once.

export interface IncomeCategoryTemplate {
  name: string;
  countsAsEarnings: boolean;
}

// The name new income falls back to when the parser picks something unknown.
export const INCOME_FALLBACK_CATEGORY = "Other Income";

export const INCOME_CATEGORY_TEMPLATE: IncomeCategoryTemplate[] = [
  // Earnings — money you actually made. These widen the budget.
  { name: "Salary", countsAsEarnings: true },
  { name: "Freelance", countsAsEarnings: true },
  { name: "Business Income", countsAsEarnings: true },
  { name: "Dividend & Interest", countsAsEarnings: true },
  { name: "Rent Received", countsAsEarnings: true },
  { name: "Bonus", countsAsEarnings: true },
  { name: "Gift", countsAsEarnings: true },
  { name: INCOME_FALLBACK_CATEGORY, countsAsEarnings: true },

  // Not earnings — money moving back to you. These must not widen the budget.
  { name: "Reimbursement", countsAsEarnings: false },
  { name: "Refund", countsAsEarnings: false },
  { name: "Money Lent Returned", countsAsEarnings: false },
  { name: "Loan / Advance Received", countsAsEarnings: false },
  { name: "Transfer Between Accounts", countsAsEarnings: false },
];
