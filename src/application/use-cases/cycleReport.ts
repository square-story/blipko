import { Bucket } from "@prisma/client";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import {
  BUCKET_META,
  bucketBudget,
  effectiveMonthlyIncome,
  formatMoney,
  incomeBasisLine,
  previousCycles,
  sanitizeMd,
} from "./budgetMath";
import { zonedYmd } from "../../utils/time";
import {
  ActionTarget,
  BucketRow,
  followUpLine,
  movers,
  nextCycleAction,
  parseActionTarget,
  unusualCategories,
} from "./cycleInsights";
import { INudgeRepository } from "../../domain/repositories/INudgeRepository";

const DEFAULT_TZ = "Asia/Kolkata";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];
// How many categories to scan per cycle when ranking movers.
const MOVER_SCAN = 50;

// NEEDS + WANTS category totals summed by name. Savings categories never feed
// "unusual" or a goal: saving more than usual is not a problem to fix.
function spendTotals(
  needs: { name: string; total: number }[],
  wants: { name: string; total: number }[],
): { name: string; total: number }[] {
  const byName = new Map<string, number>();
  for (const c of [...needs, ...wants])
    byName.set(c.name, (byName.get(c.name) ?? 0) + c.total);
  return [...byName].map(([name, total]) => ({ name, total }));
}

export interface CycleReportDeps {
  expenseRepository: IExpenseRepository;
  budgetConfigRepository: IBudgetConfigRepository;
  incomeRepository: IIncomeRepository;
  // Reads the goal last cycle's report stored on its CYCLE_REPORT row.
  nudgeRepository: Pick<INudgeRepository, "findMeta">;
}

export interface CycleReportUser {
  id: string;
  monthlyIncome: unknown;
  payday: number;
}

export interface CycleReport {
  text: string;
  endedKey: string; // period key of the ended cycle — idempotency scope
  net: number; // budget − spend for the ended cycle, as printed in the report
  // Money actually left over: logged income − spend. NOT `net`, which is built
  // on the expected-salary floor. Offering `net` would invite the user to carry
  // a salary they never received — and since the floor applies again next
  // cycle, that phantom amount compounds every time they accept it.
  cashLeftover: number;
  // The "💡 Next cycle" goal this report shows. The sender stores it on the
  // CYCLE_REPORT ledger row so the next report follows up on exactly this.
  target: ActionTarget;
}

// "May" for calendar-month cycles (payday=1), else "May 25 – Jun 25". Formats in
// `tz` — the boundaries are that zone's midnights, so the server's clock must not
// decide which month they land in.
function cycleLabel(
  start: Date,
  end: Date,
  payday: number,
  tz: string,
): string {
  if (payday <= 1) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      month: "long",
    }).format(start);
  }
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

// Signed percent change vs the prior cycle (null when there's no prior baseline).
export function pctChange(now: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((now - prev) / prev) * 100);
}

// " · ↓20% vs last" / " · ↑12% vs last" / " · same as last cycle" — the spend
// delta suffix shared by the cycle report and the on-demand /report.
export function vsLastSuffix(now: number, prev: number): string {
  const pct = pctChange(now, prev);
  if (pct == null) return "";
  if (pct === 0) return " · same as last cycle";
  return ` · ${pct > 0 ? "↑" : "↓"}${Math.abs(pct)}% vs last`;
}

// One bucket's line: spent / budget, then Δ vs last cycle (or goal status for
// SAVINGS, where spending more is good).
function bucketLine(
  bucket: Bucket,
  spent: number,
  budget: number,
  prevSpent: number,
): string {
  const meta = BUCKET_META[bucket];
  const amounts = `${formatMoney(spent)} / ${formatMoney(budget)}`;
  const vs = vsLastSuffix(spent, prevSpent);

  let status: string;
  if (bucket === "SAVINGS") {
    status =
      spent >= budget && budget > 0
        ? "✅ goal hit"
        : `⚠️ short by ${formatMoney(budget - spent)}`;
  } else {
    const delta = budget - spent;
    status =
      delta >= 0
        ? `✅ under by ${formatMoney(delta)}`
        : `↗ ${formatMoney(-delta)} past budget`;
  }
  return `${meta.emoji} ${meta.label}  ${amounts}  ${status}${vs}`;
}

// End-of-cycle summary comparing the just-ended cycle to the one before it:
// income, per-bucket spent vs budget with vs-last deltas, biggest movers, and a
// decision-oriented headline. Pure formatting on top of the repositories.
export async function buildCycleReport(
  deps: CycleReportDeps,
  user: CycleReportUser,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<CycleReport> {
  const { payday } = user;
  // [0] ended, [1] prior, [1..3] the "usual" baseline for the ended cycle.
  const cycles = previousCycles(payday, 4, now, tz);
  const ended = cycles[0]!;
  const prior = cycles[1]!;
  const totals = (c: { start: Date; end: Date }, bucket: Bucket | null) =>
    deps.expenseRepository.categoryTotals(
      user.id,
      c.start,
      c.end,
      bucket,
      MOVER_SCAN,
    );
  const [cats, spendCats] = await Promise.all([
    Promise.all(cycles.map((c) => totals(c, null))),
    Promise.all(
      cycles.map(async (c) => {
        const [needs, wants] = await Promise.all([
          totals(c, "NEEDS"),
          totals(c, "WANTS"),
        ]);
        return spendTotals(needs, wants);
      }),
    ),
  ]);
  const expected = Number(user.monthlyIncome ?? 0);
  const config =
    (await deps.budgetConfigRepository.findByUserId(user.id)) ?? DEFAULT_SPLIT;

  // Gross for the line, earned for the budget. This used to print the earned
  // figure labelled "Income logged", so a refund vanished from the wrapped
  // report while /status named it.
  const [endedGross, endedEarned, endedCarry] = await Promise.all([
    deps.incomeRepository.sumForMonth(user.id, ended.start, ended.end),
    deps.incomeRepository.sumEarnedForMonth(user.id, ended.start, ended.end),
    deps.incomeRepository.sumCarryForMonth(user.id, ended.start, ended.end),
  ]);
  const endedIncome = effectiveMonthlyIncome(expected, endedEarned, endedCarry);

  const lines: string[] = [];
  const endedBuckets: BucketRow[] = [];
  let totalSpent = 0;
  let totalPrev = 0;
  for (const bucket of ORDER) {
    const [spent, prevSpent] = await Promise.all([
      deps.expenseRepository.sumByBucketForMonth(
        user.id,
        bucket,
        ended.start,
        ended.end,
      ),
      deps.expenseRepository.sumByBucketForMonth(
        user.id,
        bucket,
        prior.start,
        prior.end,
      ),
    ]);
    totalSpent += spent;
    totalPrev += prevSpent;
    const budget = bucketBudget(endedIncome, config, bucket);
    endedBuckets.push({ bucket, spent, budget });
    lines.push(bucketLine(bucket, spent, budget, prevSpent));
  }

  const { up, down } = movers(cats[0] ?? [], cats[1] ?? []);
  const unusual = unusualCategories(spendCats[0] ?? [], spendCats.slice(1, 4));
  const cycleDays = Math.round(
    (ended.end.getTime() - ended.start.getTime()) / 86_400_000,
  );
  // The goal last cycle's report actually showed. None stored means that
  // report predates goals (or never went out), so there is nothing to check.
  const stored = await deps.nudgeRepository.findMeta(
    user.id,
    "NEEDS",
    "CYCLE_REPORT",
    zonedYmd(prior.start, tz),
  );
  const lastTarget = parseActionTarget(
    (stored as { target?: unknown } | null)?.target,
  );
  const followUp = lastTarget
    ? followUpLine(lastTarget, {
        cats: spendCats[0] ?? [],
        buckets: endedBuckets,
      })
    : null;
  const label = cycleLabel(ended.start, ended.end, payday, tz);
  const net = endedIncome - totalSpent;

  // Headline: overall spend vs last cycle, framed for a decision.
  const change = pctChange(totalSpent, totalPrev);
  let headline: string;
  if (change == null) {
    headline = `You spent ${formatMoney(totalSpent)} this cycle.`;
  } else if (change < 0) {
    headline = `Spent ${Math.abs(change)}% less than last cycle 🎉 (${formatMoney(totalSpent)}).`;
  } else if (change > 0) {
    headline = `Spent ${change}% more than last cycle (${formatMoney(totalSpent)}).`;
  } else {
    headline = `Spent the same as last cycle (${formatMoney(totalSpent)}).`;
  }

  const moverBits: string[] = [];
  if (up) moverBits.push(`${sanitizeMd(up.name)} ↑${formatMoney(up.delta)}`);
  if (down)
    moverBits.push(`${sanitizeMd(down.name)} ↓${formatMoney(-down.delta)}`);

  let text =
    `📊 ${label} wrapped\n\n` +
    headline +
    (followUp ? `\n${followUp}` : "") +
    `\n\n${incomeBasisLine(endedGross, endedEarned, endedIncome, endedCarry)}\n` +
    lines.join("\n") +
    // "budget − spend", not "income − spend": net is computed from the effective
    // figure, which carries the expected-salary floor. Saying "income" made the
    // arithmetic on screen fail to add up whenever the floor applied.
    `\n\n${net >= 0 ? "Net saved" : "Spent beyond budget"} ${formatMoney(Math.abs(net))} (budget − spend)`;

  if (moverBits.length > 0) {
    text += `\n\nBiggest movers: ${moverBits.join(" · ")}`;
  }

  if (unusual.length > 0) {
    text += `\n\nUnusual this cycle: ${unusual
      .map(
        (u) =>
          `${sanitizeMd(u.name)} ${formatMoney(u.total)} (usually ${formatMoney(u.usual)})`,
      )
      .join(" · ")}`;
  }
  const action = nextCycleAction({ unusual, buckets: endedBuckets, cycleDays });
  text += `\n\n${action.text}`;

  return {
    text,
    endedKey: zonedYmd(ended.start, tz),
    net,
    cashLeftover: endedGross - totalSpent,
    target: action.target,
  };
}
