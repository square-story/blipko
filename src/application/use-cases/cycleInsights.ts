import { Bucket } from "@prisma/client";
import { BUCKET_META, formatMoney, sanitizeMd } from "./budgetMath";

// Pure decision logic for the end-of-cycle report: what moved, what was out of
// the ordinary, and the one thing to change next cycle. No repositories — the
// report fetches the numbers and hands them in.

export type CatTotal = { name: string; total: number };
export type BucketRow = { bucket: Bucket; spent: number; budget: number };
export type Unusual = { name: string; total: number; usual: number };
export type ActionTarget =
  | { kind: "category"; name: string; limit: number }
  | { kind: "bucket"; bucket: Bucket }
  | { kind: "savings" }
  | { kind: "none" };

// Below this excess a "2× usual" jump is noise (₹40 → ₹120 chai money).
const MIN_EXCESS = 500;
const MAX_UNUSUAL = 2;
const SPENDING: Bucket[] = ["NEEDS", "WANTS"];

// A category is unusual when it ran at least double its usual, by a real
// amount. "Usual" needs ≥2 baseline cycles; one prior cycle is an anecdote.
export function unusualCategories(
  ended: CatTotal[],
  baseline: CatTotal[][],
): Unusual[] {
  const seen = new Map<string, number[]>();
  for (const cycle of baseline)
    for (const c of cycle)
      seen.set(c.name, [...(seen.get(c.name) ?? []), c.total]);

  const out: Unusual[] = [];
  for (const { name, total } of ended) {
    const past = seen.get(name);
    if (!past || past.length < 2) continue;
    const usual = past.reduce((a, b) => a + b, 0) / past.length;
    if (total >= 2 * usual && total - usual >= MIN_EXCESS)
      out.push({ name, total, usual });
  }
  return out
    .sort((a, b) => b.total - b.usual - (a.total - a.usual))
    .slice(0, MAX_UNUSUAL);
}

// One concrete suggestion, first matching rule wins. The target is what the
// next report checks against (followUpLine), so it carries the numbers.
export function nextCycleAction(input: {
  unusual: Unusual[];
  buckets: BucketRow[];
  cycleDays: number;
}): { text: string; target: ActionTarget } {
  const top = input.unusual[0];
  if (top) {
    return {
      text: `💡 Next cycle: keep ${sanitizeMd(top.name)} near its usual ${formatMoney(top.usual)} — that frees ${formatMoney(top.total - top.usual)}.`,
      target: { kind: "category", name: top.name, limit: top.usual },
    };
  }

  const over = input.buckets
    .filter((b) => SPENDING.includes(b.bucket) && b.spent > b.budget)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget))[0];
  if (over) {
    return {
      text: `💡 Next cycle: ${BUCKET_META[over.bucket].label} ran ${formatMoney(over.spent - over.budget)} past budget — about ${formatMoney(over.budget / Math.max(1, input.cycleDays))}/day keeps it on track.`,
      target: { kind: "bucket", bucket: over.bucket },
    };
  }

  const savings = input.buckets.find((b) => b.bucket === "SAVINGS");
  if (savings && savings.spent < savings.budget) {
    return {
      text: `💡 Next cycle: move ${formatMoney(savings.budget - savings.spent)} to savings on payday, before spending starts.`,
      target: { kind: "savings" },
    };
  }

  return {
    text: "💡 Next cycle: same plan — it worked.",
    target: { kind: "none" },
  };
}

// Closes the loop: did the cycle that just ended follow last cycle's
// suggestion? The target is recomputed from last cycle's data, so nothing is
// stored. A category within 10% of its limit counts as done.
export function followUpLine(
  target: ActionTarget,
  ended: { cats: CatTotal[]; buckets: BucketRow[] },
): string | null {
  const head = "Last cycle's goal —";
  if (target.kind === "category") {
    const actual = ended.cats.find((c) => c.name === target.name)?.total ?? 0;
    const goal = `${sanitizeMd(target.name)} near ${formatMoney(target.limit)}`;
    return actual <= target.limit * 1.1
      ? `✅ ${head} ${goal}: done (${formatMoney(actual)}).`
      : `↗ ${head} ${goal}: came in at ${formatMoney(actual)}.`;
  }
  if (target.kind === "bucket") {
    const row = ended.buckets.find((b) => b.bucket === target.bucket);
    if (!row) return null;
    const goal = `${BUCKET_META[target.bucket].label} within budget`;
    return row.spent <= row.budget
      ? `✅ ${head} ${goal}: done.`
      : `↗ ${head} ${goal}: ran ${formatMoney(row.spent - row.budget)} past.`;
  }
  if (target.kind === "savings") {
    const row = ended.buckets.find((b) => b.bucket === "SAVINGS");
    if (!row) return null;
    return row.spent >= row.budget
      ? `✅ ${head} savings target: done.`
      : `↗ ${head} savings target: short by ${formatMoney(row.budget - row.spent)}.`;
  }
  return null;
}

// Category deltas (ended − prior) across the union of both cycles' categories.
// Returns the single biggest riser and faller.
export function movers(
  ended: CatTotal[],
  prior: CatTotal[],
): {
  up: { name: string; delta: number } | null;
  down: { name: string; delta: number } | null;
} {
  const deltas = new Map<string, number>();
  for (const c of ended)
    deltas.set(c.name, (deltas.get(c.name) ?? 0) + c.total);
  for (const c of prior)
    deltas.set(c.name, (deltas.get(c.name) ?? 0) - c.total);

  let up: { name: string; delta: number } | null = null;
  let down: { name: string; delta: number } | null = null;
  for (const [name, delta] of deltas) {
    if (delta > 0 && (!up || delta > up.delta)) up = { name, delta };
    if (delta < 0 && (!down || delta < down.delta)) down = { name, delta };
  }
  return { up, down };
}
