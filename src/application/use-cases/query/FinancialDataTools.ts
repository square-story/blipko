import { Bucket, User } from "@prisma/client";
import {
  Affordability,
  Boxes,
  BucketBudgetStatus,
  BucketStatus,
  Categories,
  CycleComparison,
  CycleSummary,
  DateRange,
  IFinancialDataTools,
  IncomeTotal,
  PeriodStatus,
  RecentExpenses,
  RecurringRules,
  ResolvedRange,
  SpendByBucket,
  SpendByCategory,
} from "../../../domain/services/IFinancialDataTools";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBoxRepository } from "../../../domain/repositories/IBoxRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  pctSpent,
  periodDayInfo,
  previousCycles,
} from "../budgetMath";
import { zonedParts, zonedStartOfDayUtc, zonedYmd } from "../../../utils/time";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// A spend swing smaller than this reads as noise, not a trend.
const FLAT_DELTA_PCT = 5;
// Above this share of the bucket budget, a bucket is "near limit".
const NEAR_LIMIT_PCT = 80;

const NO_SPEND_NOTE =
  "No expenses are recorded for this range. That means nothing was logged — it is NOT the same as the user having spent ₹0.";
const NO_INCOME_NOTE =
  "No income is recorded for this range. That means nothing was logged — it is NOT proof the user earned nothing.";

// Read-only data tools for the conversational query agent. Reuses the same
// repositories + budgetMath as the deterministic processors, so answers match
// what /status and /report would show. No method ever writes.
//
// Everything monetary leaves this class already formatted, and every comparison
// the answer depends on (bucket status, affordability verdict, cycle direction)
// is decided here. See the grounding contract on IFinancialDataTools.
export class FinancialDataTools implements IFinancialDataTools {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly boxRepository: IBoxRepository,
  ) {}

  async getPeriodStatus(userId: string): Promise<PeriodStatus> {
    const user = await this.requireUser(userId);
    const cycle = await this.cycleFigures(user);

    const buckets = await Promise.all(
      ORDER.map((bucket) => this.bucketStatus(user.id, bucket, cycle)),
    );

    return {
      currency: user.currency,
      periodStart: zonedYmd(cycle.start, cycle.tz),
      periodEnd: lastDayOf(cycle.end, cycle.tz),
      day: cycle.day,
      daysInPeriod: cycle.daysInPeriod,
      remainingDays: cycle.remainingDays,
      monthlyIncome: formatMoney(cycle.monthlyIncome),
      incomeLogged: formatMoney(cycle.incomeLogged),
      buckets,
    };
  }

  async getSpendByBucket(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
  ): Promise<SpendByBucket> {
    const user = await this.requireUser(userId);
    const { from, to, resolved } = this.resolveRange(user, range);
    const wanted = bucket ? [bucket] : ORDER;
    const totals = await Promise.all(
      wanted.map(async (b) => ({
        bucket: b,
        raw: await this.expenseRepository.sumByBucketForMonth(
          userId,
          b,
          from,
          to,
        ),
      })),
    );

    const result: SpendByBucket = {
      range: resolved,
      buckets: totals.map((t) => ({
        bucket: t.bucket,
        total: formatMoney(t.raw),
      })),
    };
    if (totals.every((t) => t.raw === 0)) result.note = NO_SPEND_NOTE;
    return result;
  }

  async getSpendByCategory(
    userId: string,
    range: DateRange,
    bucket?: Bucket,
    limit = 5,
  ): Promise<SpendByCategory> {
    const user = await this.requireUser(userId);
    const { from, to, resolved } = this.resolveRange(user, range);
    const rows = await this.expenseRepository.categoryTotals(
      userId,
      from,
      to,
      bucket ?? null,
      clamp(limit, 1, 20),
    );

    const result: SpendByCategory = {
      range: resolved,
      categories: rows.map((r) => ({
        name: r.name,
        total: formatMoney(r.total),
      })),
    };
    if (rows.length === 0) result.note = NO_SPEND_NOTE;
    return result;
  }

  async getIncome(userId: string, range: DateRange): Promise<IncomeTotal> {
    const user = await this.requireUser(userId);
    const { from, to, resolved } = this.resolveRange(user, range);
    const total = await this.incomeRepository.sumForMonth(userId, from, to);

    const result: IncomeTotal = { range: resolved, total: formatMoney(total) };
    if (total === 0) result.note = NO_INCOME_NOTE;
    return result;
  }

  async getRecentExpenses(
    userId: string,
    opts: {
      limit?: number | undefined;
      category?: string | undefined;
      range?: DateRange | undefined;
    },
  ): Promise<RecentExpenses> {
    const user = await this.requireUser(userId);
    // No default range here — "recent" spans all time unless the user narrows it.
    const resolved = opts.range ? this.resolveRange(user, opts.range) : null;
    const rows = await this.expenseRepository.findRecent(userId, {
      limit: clamp(opts.limit ?? 10, 1, 50),
      categoryName: opts.category,
      from: resolved?.from,
      to: resolved?.to,
    });

    const result: RecentExpenses = {
      rows: rows.map((r) => ({
        id: r.id,
        date: zonedYmd(r.date, user.timezone),
        amount: formatMoney(r.amount),
        bucket: r.bucket,
        category: r.categoryName,
        note: r.note,
      })),
    };
    if (rows.length === 0) result.note = NO_SPEND_NOTE;
    return result;
  }

  async getRecurringRules(userId: string): Promise<RecurringRules> {
    const rules = await this.recurringRuleRepository.findByUserId(userId);
    // One lookup for the whole taxonomy instead of one per rule.
    const categories = await this.categoryRepository.findAllForUser(userId);
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const result: RecurringRules = {
      rules: rules.map((r) => ({
        kind: r.kind,
        amount: formatMoney(Number(r.amount)),
        dayOfMonth: r.dayOfMonth,
        bucket: r.bucket ?? null,
        category: r.categoryId ? (nameById.get(r.categoryId) ?? null) : null,
        note: r.note ?? null,
      })),
    };
    if (rules.length === 0) {
      result.note = "The user has no recurring rules set up.";
    }
    return result;
  }

  async getCategories(userId: string): Promise<Categories> {
    const all = await this.categoryRepository.findAllForUser(userId);
    // Leaves only. Groups are containers — an expense can never attach to one,
    // so offering them to the model just invites uncategorized spends.
    const leaves = all.filter((c) => !c.isGroup);

    // One entry per NAME, preferring the user's own row over the shared system
    // template. findAllForUser returns both, so without this most names appear
    // twice — duplicated in the tool schema's enum and in the list the model
    // reads back to the user.
    const byName = new Map<string, (typeof leaves)[number]>();
    for (const c of leaves) {
      const existing = byName.get(c.name);
      if (!existing || (existing.userId === null && c.userId === userId)) {
        byName.set(c.name, c);
      }
    }
    const unique = [...byName.values()];

    const result: Categories = {
      categories: unique.map((c) => ({
        name: c.name,
        bucket: c.bucket,
        monthlyBudget:
          c.monthlyBudget === null
            ? null
            : formatMoney(Number(c.monthlyBudget)),
      })),
    };
    if (unique.length === 0) result.note = "The user has no categories yet.";
    return result;
  }

  async getBoxes(userId: string): Promise<Boxes> {
    const boxes = await this.boxRepository.listWithBalances(userId);

    const result: Boxes = {
      boxes: boxes.map((b) => {
        const target = b.targetAmount === null ? null : Number(b.targetAmount);
        return {
          name: b.name,
          balance: formatMoney(b.balance),
          target: target === null ? null : formatMoney(target),
          pctOfTarget:
            target === null || target <= 0
              ? null
              : Math.round((b.balance / target) * 100),
        };
      }),
    };
    if (boxes.length === 0) result.note = "The user has no boxes yet.";
    return result;
  }

  async compareCycles(userId: string, cycles = 1): Promise<CycleComparison> {
    const user = await this.requireUser(userId);
    const tz = user.timezone;
    const now = new Date();
    const n = clamp(cycles, 1, 6);

    const current = currentBudgetPeriod(user.payday, now, tz);
    const windows = [current, ...previousCycles(user.payday, n, now, tz)];
    const scored = await Promise.all(
      windows.map((w, i) => this.cycleSummary(userId, w, cycleLabel(i), tz)),
    );

    const { day, daysInPeriod } = periodDayInfo(user.payday, now, tz);
    return {
      cycles: scored.map((s) => s.summary),
      vsPrevious: cycleDelta(scored, day, daysInPeriod),
    };
  }

  async checkAffordability(
    userId: string,
    amount: number,
    bucket: Bucket = "WANTS",
  ): Promise<Affordability> {
    const user = await this.requireUser(userId);
    const cycle = await this.cycleFigures(user);
    const { budget, remaining: remainingBefore } = await this.bucketFigures(
      user.id,
      bucket,
      cycle,
    );

    const remainingAfter = remainingBefore - amount;
    const days = cycle.remainingDays;
    const verdict: Affordability["verdict"] =
      budget <= 0 || remainingBefore <= 0 || remainingAfter < 0
        ? "NO"
        : remainingAfter < remainingBefore / 2
          ? "TIGHT"
          : "YES";

    return {
      amount: formatMoney(amount),
      bucket,
      verdict,
      remainingBefore: money(remainingBefore),
      remainingAfter: money(remainingAfter),
      daysLeft: days,
      safeDailyBefore: formatMoney(safeDaily(remainingBefore, days)),
      safeDailyAfter: formatMoney(safeDaily(remainingAfter, days)),
      reason: affordabilityReason(
        verdict,
        bucket,
        budget,
        remainingBefore,
        remainingAfter,
        days,
      ),
    };
  }

  // The cycle-wide numbers every budget answer is derived from. Loaded once per
  // tool call so payday/timezone/income are read exactly one way.
  private async cycleFigures(user: User): Promise<CycleFigures> {
    const tz = user.timezone;
    const now = new Date();
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const { start, end } = currentBudgetPeriod(user.payday, now, tz);
    const { day, daysInPeriod, remainingDays } = periodDayInfo(
      user.payday,
      now,
      tz,
    );
    // Two different numbers on purpose: incomeLogged is what actually landed
    // (what the model should quote), incomeEarned is what the budget is built on.
    // A refund shows up in the first and not the second.
    const [incomeLogged, incomeEarned] = await Promise.all([
      this.incomeRepository.sumForMonth(user.id, start, end),
      this.incomeRepository.sumEarnedForMonth(user.id, start, end),
    ]);
    return {
      tz,
      config,
      start,
      end,
      day,
      daysInPeriod,
      remainingDays,
      incomeLogged,
      monthlyIncome: effectiveMonthlyIncome(
        Number(user.monthlyIncome ?? 0),
        incomeEarned,
      ),
    };
  }

  private async bucketFigures(
    userId: string,
    bucket: Bucket,
    cycle: CycleFigures,
  ): Promise<{ budget: number; spent: number; remaining: number }> {
    const budget = bucketBudget(cycle.monthlyIncome, cycle.config, bucket);
    const spent = await this.expenseRepository.sumByBucketForMonth(
      userId,
      bucket,
      cycle.start,
      cycle.end,
    );
    return { budget, spent, remaining: budget - spent };
  }

  private async bucketStatus(
    userId: string,
    bucket: Bucket,
    cycle: CycleFigures,
  ): Promise<BucketStatus> {
    const { budget, spent, remaining } = await this.bucketFigures(
      userId,
      bucket,
      cycle,
    );
    const pct = pctSpent(spent, budget);
    const status = bucketStatusOf(spent, budget, pct);
    return {
      bucket,
      budget: formatMoney(budget),
      spent: formatMoney(spent),
      remaining: money(remaining),
      pct,
      safeDaily: formatMoney(safeDaily(remaining, cycle.remainingDays)),
      status,
      interpretation: interpretBucket(bucket, status, budget, remaining),
    };
  }

  private async cycleSummary(
    userId: string,
    window: { start: Date; end: Date },
    label: string,
    tz: string,
  ): Promise<ScoredCycle> {
    const [buckets, income] = await Promise.all([
      Promise.all(
        ORDER.map(async (b) => ({
          bucket: b,
          raw: await this.expenseRepository.sumByBucketForMonth(
            userId,
            b,
            window.start,
            window.end,
          ),
        })),
      ),
      this.incomeRepository.sumForMonth(userId, window.start, window.end),
    ]);

    const rawTotal = buckets.reduce((s, b) => s + b.raw, 0);
    return {
      rawTotal,
      summary: {
        label,
        start: zonedYmd(window.start, tz),
        end: lastDayOf(window.end, tz),
        total: formatMoney(rawTotal),
        buckets: buckets.map((b) => ({
          bucket: b.bucket,
          total: formatMoney(b.raw),
        })),
        income: formatMoney(income),
      },
    };
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error(`FinancialDataTools: user ${userId} not found`);
    return user;
  }

  // Resolve a caller-facing range (YYYY-MM-DD in the user's timezone, `to`
  // INCLUSIVE) to the half-open [from, to) the repositories expect. Defaults to
  // the current budget cycle. Dates are anchored to the user's wall clock, not
  // the server's — a 00:30 IST spend must land on the day the user calls it.
  private resolveRange(
    user: User,
    range: DateRange,
  ): { from: Date; to: Date; resolved: ResolvedRange } {
    const tz = tzOf(user);
    const period = currentBudgetPeriod(user.payday, new Date(), tz);
    const from = parseZonedDate(range.from, tz) ?? period.start;
    const toInclusive = parseZonedDate(range.to, tz);
    const to = toInclusive ? addDaysZoned(toInclusive, 1, tz) : period.end;
    return {
      from,
      to,
      resolved: { from: zonedYmd(from, tz), to: lastDayOf(to, tz) },
    };
  }
}

// Cycle-wide numbers, loaded once and threaded through the per-bucket helpers.
interface CycleFigures {
  tz: string;
  config: { needsPct: number; wantsPct: number; savingsPct: number };
  start: Date;
  end: Date; // exclusive
  day: number;
  daysInPeriod: number;
  remainingDays: number;
  incomeLogged: number;
  monthlyIncome: number;
}

// A cycle summary plus the raw total behind it, so deltas are computed from
// numbers rather than parsed back out of formatted strings.
interface ScoredCycle {
  summary: CycleSummary;
  rawTotal: number;
}

function tzOf(user: User): string {
  return user.timezone;
}

function cycleLabel(index: number): string {
  if (index === 0) return "current";
  if (index === 1) return "previous";
  return `${index} cycles ago`;
}

// Direction and delta are decided here so the model never subtracts two totals
// itself — and so a 3-days-in cycle can't be reported as a real drop.
function cycleDelta(
  scored: ScoredCycle[],
  day: number,
  daysInPeriod: number,
): CycleComparison["vsPrevious"] {
  const [current, previous] = scored;
  if (!current || !previous) return null;

  const delta = current.rawTotal - previous.rawTotal;
  const deltaPct =
    previous.rawTotal > 0 ? Math.round((delta / previous.rawTotal) * 100) : 0;
  const direction =
    previous.rawTotal === 0
      ? current.rawTotal > 0
        ? "UP"
        : "FLAT"
      : Math.abs(deltaPct) < FLAT_DELTA_PCT
        ? "FLAT"
        : delta > 0
          ? "UP"
          : "DOWN";

  return {
    direction,
    deltaPct,
    delta: signedMoney(delta),
    note: `The current cycle is only day ${day} of ${daysInPeriod}, so this compares a partial cycle against a complete one. Say so when reporting it.`,
  };
}

// Parse "YYYY-MM-DD" (or an ISO timestamp — the date part wins) as midnight in
// the user's timezone. Bare `new Date(iso)` would give UTC midnight, which is
// 5.5h off an IST cycle boundary.
function parseZonedDate(iso: string | undefined, tz: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return zonedStartOfDayUtc(Number(m[1]), Number(m[2]), Number(m[3]), tz);
}

function addDaysZoned(date: Date, days: number, tz: string): Date {
  const p = zonedParts(date, tz);
  return zonedStartOfDayUtc(p.year, p.month, p.day + days, tz);
}

// The inclusive last day of a half-open range ending at `end`.
function lastDayOf(end: Date, tz: string): string {
  return zonedYmd(new Date(end.getTime() - 1), tz);
}

function safeDaily(remaining: number, days: number): number {
  if (remaining <= 0 || days <= 0) return 0;
  return remaining / days;
}

function bucketStatusOf(
  spent: number,
  budget: number,
  pct: number,
): BucketBudgetStatus {
  if (spent <= 0) return "NO_ACTIVITY";
  if (budget <= 0) return "OVER";
  if (pct > 100) return "OVER";
  if (pct >= NEAR_LIMIT_PCT) return "NEAR_LIMIT";
  return "ON_TRACK";
}

// Over-spending WANTS is a problem; over-saving is the goal. The model should
// never have to infer that difference, so we state it.
function interpretBucket(
  bucket: Bucket,
  status: BucketBudgetStatus,
  budget: number,
  remaining: number,
): string {
  const label = BUCKET_META[bucket].label;
  if (budget <= 0) {
    return `No ${label} budget is set — the user has no income recorded this cycle.`;
  }
  if (bucket === "SAVINGS") {
    return status === "OVER"
      ? `${label} is above target by ${formatMoney(Math.abs(remaining))} — that is good.`
      : `${label} is ${formatMoney(remaining)} short of target.`;
  }
  switch (status) {
    case "OVER":
      return `${label} is over budget by ${formatMoney(Math.abs(remaining))}.`;
    case "NEAR_LIMIT":
      return `${label} is close to its limit — ${formatMoney(remaining)} left.`;
    case "NO_ACTIVITY":
      return `Nothing has been logged in ${label} this cycle.`;
    default:
      return `${label} is on track — ${formatMoney(remaining)} left.`;
  }
}

function affordabilityReason(
  verdict: Affordability["verdict"],
  bucket: Bucket,
  budget: number,
  remainingBefore: number,
  remainingAfter: number,
  days: number,
): string {
  const label = BUCKET_META[bucket].label;
  if (verdict === "NO") {
    if (budget <= 0) {
      return `There is no ${label} budget to check against — the user has no income recorded this cycle.`;
    }
    return remainingBefore <= 0
      ? `${label} is already out of budget this cycle.`
      : `It would put ${label} over budget by ${formatMoney(Math.abs(remainingAfter))}.`;
  }
  const after = formatMoney(safeDaily(remainingAfter, days));
  return verdict === "TIGHT"
    ? `It fits, but takes more than half of what is left in ${label} — ${formatMoney(remainingAfter)} would remain, ${after}/day for ${days} days.`
    : `It fits comfortably — ${formatMoney(remainingAfter)} would remain in ${label}, ${after}/day for ${days} days.`;
}

function money(n: number): string {
  return n < 0 ? `-${formatMoney(Math.abs(n))}` : formatMoney(n);
}

function signedMoney(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return formatMoney(0);
  return `${rounded > 0 ? "+" : "-"}${formatMoney(Math.abs(n))}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(n) || min, min), max);
}
