import { Bucket } from "@prisma/client";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import {
  BUCKET_META,
  bucketBudget,
  effectiveMonthlyIncome,
  formatMoney,
  previousCycles,
  sanitizeMd,
} from "./budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const ORDER: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];
// How many categories to scan per cycle when ranking movers.
const MOVER_SCAN = 50;

export interface CycleReportDeps {
  expenseRepository: IExpenseRepository;
  budgetConfigRepository: IBudgetConfigRepository;
  incomeRepository: IIncomeRepository;
}

export interface CycleReportUser {
  id: string;
  monthlyIncome: unknown;
  payday: number;
}

export interface CycleReport {
  text: string;
  endedKey: string; // period key of the ended cycle — idempotency scope
}

// "YYYY-MM-DD" of a date — matches periodKey's format.
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

// "May" for calendar-month cycles (payday=1), else "May 25 – Jun 25".
function cycleLabel(start: Date, end: Date, payday: number): string {
  if (payday <= 1) {
    return new Intl.DateTimeFormat("en-IN", { month: "long" }).format(start);
  }
  const fmt = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

// Signed percent change vs the prior cycle (null when there's no prior baseline).
function pctChange(now: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((now - prev) / prev) * 100);
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
  const pct = pctChange(spent, prevSpent);
  const vs =
    pct == null
      ? ""
      : pct === 0
        ? " · same as last cycle"
        : ` · ${pct > 0 ? "↑" : "↓"}${Math.abs(pct)}% vs last`;

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
        : `❌ over by ${formatMoney(-delta)}`;
  }
  return `${meta.emoji} ${meta.label}  ${amounts}  ${status}${vs}`;
}

// Category deltas (ended − prior) across the union of both cycles' categories,
// sorted by signed change. Returns the single biggest riser and faller.
async function movers(
  deps: CycleReportDeps,
  userId: string,
  ended: { start: Date; end: Date },
  prior: { start: Date; end: Date },
): Promise<{
  up: { name: string; delta: number } | null;
  down: { name: string; delta: number } | null;
}> {
  const [endedCats, priorCats] = await Promise.all([
    deps.expenseRepository.categoryTotals(
      userId,
      ended.start,
      ended.end,
      null,
      MOVER_SCAN,
    ),
    deps.expenseRepository.categoryTotals(
      userId,
      prior.start,
      prior.end,
      null,
      MOVER_SCAN,
    ),
  ]);

  const deltas = new Map<string, number>();
  for (const c of endedCats)
    deltas.set(c.name, (deltas.get(c.name) ?? 0) + c.total);
  for (const c of priorCats)
    deltas.set(c.name, (deltas.get(c.name) ?? 0) - c.total);

  let up: { name: string; delta: number } | null = null;
  let down: { name: string; delta: number } | null = null;
  for (const [name, delta] of deltas) {
    if (delta > 0 && (!up || delta > up.delta)) up = { name, delta };
    if (delta < 0 && (!down || delta < down.delta)) down = { name, delta };
  }
  return { up, down };
}

// End-of-cycle summary comparing the just-ended cycle to the one before it:
// income, per-bucket spent vs budget with vs-last deltas, biggest movers, and a
// decision-oriented headline. Pure formatting on top of the repositories.
export async function buildCycleReport(
  deps: CycleReportDeps,
  user: CycleReportUser,
  now: Date = new Date(),
): Promise<CycleReport> {
  const { payday } = user;
  const cycles = previousCycles(payday, 2, now);
  const ended = cycles[0]!;
  const prior = cycles[1]!;
  const expected = Number(user.monthlyIncome ?? 0);
  const config =
    (await deps.budgetConfigRepository.findByUserId(user.id)) ?? DEFAULT_SPLIT;

  const endedLogged = await deps.incomeRepository.sumForMonth(
    user.id,
    ended.start,
    ended.end,
  );
  const endedIncome = effectiveMonthlyIncome(expected, endedLogged);

  const lines: string[] = [];
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
    lines.push(
      bucketLine(
        bucket,
        spent,
        bucketBudget(endedIncome, config, bucket),
        prevSpent,
      ),
    );
  }

  const { up, down } = await movers(deps, user.id, ended, prior);
  const label = cycleLabel(ended.start, ended.end, payday);
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
    `\n\nIncome logged ${formatMoney(endedLogged)} (budget on ${formatMoney(endedIncome)})\n` +
    lines.join("\n") +
    `\n\n${net >= 0 ? "Net saved" : "Net overspent"} ${formatMoney(Math.abs(net))} (income − spend)`;

  if (moverBits.length > 0) {
    text += `\n\nBiggest movers: ${moverBits.join(" · ")}`;
  }

  return { text, endedKey: dateKey(ended.start) };
}
