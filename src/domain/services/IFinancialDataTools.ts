import { Bucket } from "@prisma/client";

// Read-only data accessors the query agent calls as tools. Each is scoped to a
// single user (userId is bound server-side, never supplied by the model). All
// dates are ISO strings on the wire; ranges default to the current budget cycle.

export interface DateRange {
  from?: string | undefined; // ISO date; defaults to current period start
  to?: string | undefined; // ISO date (exclusive); defaults to current period end
}

export interface BucketStatus {
  bucket: Bucket;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
}

export interface PeriodStatus {
  currency: string;
  periodStart: string;
  periodEnd: string;
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  monthlyIncome: number; // effective income the budget is computed on
  incomeLogged: number;
  buckets: BucketStatus[];
}

export interface CategoryTotal {
  name: string;
  total: number;
}

export interface RecentExpense {
  date: string;
  amount: number;
  bucket: Bucket;
  category: string;
  note: string | null;
}

export interface RecurringRuleSummary {
  kind: string;
  amount: number;
  dayOfMonth: number;
  bucket: string | null;
  category: string | null;
  note: string | null;
}

export interface IFinancialDataTools {
  getPeriodStatus(userId: string): Promise<PeriodStatus>;
  getSpendByBucket(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
  ): Promise<Array<{ bucket: Bucket; total: number }>>;
  getSpendByCategory(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
    limit?: number,
  ): Promise<CategoryTotal[]>;
  getIncome(userId: string, range: DateRange): Promise<{ total: number }>;
  getRecentExpenses(
    userId: string,
    opts: {
      limit?: number | undefined;
      category?: string | undefined;
      range?: DateRange | undefined;
    },
  ): Promise<RecentExpense[]>;
  getRecurringRules(userId: string): Promise<RecurringRuleSummary[]>;
}
