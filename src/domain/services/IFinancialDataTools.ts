import { Bucket } from "@prisma/client";

// Read-only data accessors the query agent calls as tools. Each is scoped to a
// single user (userId is bound server-side, never supplied by the model).
//
// GROUNDING CONTRACT — every method here obeys all four:
//  1. Money is returned PRE-FORMATTED ("₹1,200"). The model quotes strings; it
//     never sees a raw rupee number it could do arithmetic on and get wrong.
//  2. Every comparison/verdict the answer depends on is computed here, not by
//     the model (see `status`, `verdict`, `direction`).
//  3. Empty results carry an explicit `note` — "no rows" is not "spent ₹0".
//  4. Dates on the wire are "YYYY-MM-DD" in the USER'S timezone, and `to` is
//     INCLUSIVE (the caller-facing contract; converted to a half-open range
//     internally). Exclusive end dates are an off-by-one trap for an LLM.

export interface DateRange {
  from?: string | undefined; // YYYY-MM-DD; defaults to current cycle start
  to?: string | undefined; // YYYY-MM-DD INCLUSIVE; defaults to current cycle end
}

// The range a result actually covers, echoed back so the model states the
// window it is talking about instead of guessing what its input resolved to.
export interface ResolvedRange {
  from: string;
  to: string; // inclusive
}

// Budget consumption for one bucket. `status` exists so the model never has to
// compare spent against budget itself; `interpretation` exists because "over"
// means something different for SAVINGS (good) than for WANTS (bad).
export type BucketBudgetStatus =
  | "NO_ACTIVITY"
  | "ON_TRACK"
  | "NEAR_LIMIT"
  | "OVER";

export interface BucketStatus {
  bucket: Bucket;
  budget: string;
  spent: string;
  remaining: string;
  pct: number;
  safeDaily: string;
  // For the model to reason with, never to quote — it leaked to a user once as
  // "you're ON_TRACK on all three". Deliberately abstract because its meaning
  // depends on the bucket, which is what `interpretation` resolves.
  status: BucketBudgetStatus;
  // The sentence to actually say. Bucket-aware: over on SAVINGS reads as good.
  interpretation: string;
}

export interface PeriodStatus {
  currency: string;
  periodStart: string;
  periodEnd: string; // inclusive last day of the cycle
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  monthlyIncome: string; // effective income the budget is computed on
  incomeLogged: string;
  buckets: BucketStatus[];
}

export interface SpendByBucket {
  range: ResolvedRange;
  buckets: Array<{ bucket: Bucket; total: string }>;
  note?: string;
}

export interface SpendByCategory {
  range: ResolvedRange;
  categories: Array<{ name: string; total: string }>;
  note?: string;
}

// What the balance should be now: the user's last stated balance plus
// everything logged since. Never the real bank balance — Blipko can't see it.
export interface ExpectedBalanceResult {
  anchor?: string;
  anchoredOn?: string; // YYYY-MM-DD, user's timezone
  incomeSince?: string;
  spentSince?: string;
  expectedNow?: string;
  note?: string;
}

export interface IncomeTotal {
  range: ResolvedRange;
  total: string;
  note?: string;
}

export interface RecentExpense {
  // Needed so the assistant can propose an edit or delete against a real row
  // rather than describing one in prose.
  id: string;
  date: string;
  amount: string;
  bucket: Bucket;
  category: string;
  note: string | null;
}

export interface RecentExpenses {
  rows: RecentExpense[];
  note?: string;
}

export interface RecurringRuleSummary {
  kind: string;
  amount: string;
  dayOfMonth: number;
  bucket: string | null;
  category: string | null;
  note: string | null;
}

export interface RecurringRules {
  rules: RecurringRuleSummary[];
  note?: string;
}

export interface CategorySummary {
  name: string;
  bucket: Bucket;
  monthlyBudget: string | null;
}

export interface Categories {
  categories: CategorySummary[];
  note?: string;
}

export interface BoxSummary {
  name: string;
  balance: string;
  target: string | null;
  pctOfTarget: number | null;
}

export interface Boxes {
  boxes: BoxSummary[];
  note?: string;
}

export interface CycleSummary {
  label: string; // "current" | "previous" | "3 cycles ago"
  start: string;
  end: string; // inclusive
  total: string; // all-bucket spend
  buckets: Array<{ bucket: Bucket; total: string }>;
  income: string;
}

export interface CycleComparison {
  cycles: CycleSummary[]; // newest first; [0] is the current (partial) cycle
  // Null when there is no completed previous cycle to compare against.
  vsPrevious: {
    direction: "UP" | "DOWN" | "FLAT";
    deltaPct: number;
    delta: string; // signed, formatted
    note: string; // states how far into the current cycle we are
  } | null;
}

export interface Affordability {
  amount: string;
  bucket: Bucket;
  verdict: "YES" | "TIGHT" | "NO";
  remainingBefore: string;
  remainingAfter: string;
  daysLeft: number;
  safeDailyBefore: string;
  safeDailyAfter: string;
  reason: string;
}

export interface IFinancialDataTools {
  getPeriodStatus(userId: string): Promise<PeriodStatus>;
  getSpendByBucket(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
  ): Promise<SpendByBucket>;
  getSpendByCategory(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
    limit?: number,
  ): Promise<SpendByCategory>;
  getIncome(userId: string, range: DateRange): Promise<IncomeTotal>;
  getExpectedBalance(userId: string): Promise<ExpectedBalanceResult>;
  getRecentExpenses(
    userId: string,
    opts: {
      limit?: number | undefined;
      category?: string | undefined;
      range?: DateRange | undefined;
    },
  ): Promise<RecentExpenses>;
  getRecurringRules(userId: string): Promise<RecurringRules>;
  getCategories(userId: string): Promise<Categories>;
  getBoxes(userId: string): Promise<Boxes>;
  // Current cycle vs the N most recent COMPLETE cycles, with the delta and
  // direction computed here so the model never subtracts two totals itself.
  compareCycles(userId: string, cycles?: number): Promise<CycleComparison>;
  // Whether `amount` fits in the remaining bucket budget. The verdict is
  // decided here — the prompt must never ask the model to do this subtraction.
  checkAffordability(
    userId: string,
    amount: number,
    bucket?: Bucket,
  ): Promise<Affordability>;
}
