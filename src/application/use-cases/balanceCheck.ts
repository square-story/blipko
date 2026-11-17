import { Bucket } from "@prisma/client";
import { IBoxRepository } from "../../domain/repositories/IBoxRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { CARRY_EXPENSE_CATEGORY, parseBareAmount } from "./carryFlow";

// Balance check: the user states their real total balance (bank + UPI + cash),
// and we compare it with the last one plus everything logged since. The gap is
// the money that moved without being logged.

const BALANCE_TEXT =
  /^\/?(?:my\s+)?(?:(?:bank|account)\s+)?bal(?:ance)?(?:\s+is)?\s*[:=-]?\s*(.*)$/i;

// null → not a balance message (falls through to the parser). { amount: null }
// → a bare "/balance", asking what the balance should be.
export function parseBalanceText(
  text: string,
): { amount: number | null } | null {
  const m = BALANCE_TEXT.exec((text ?? "").trim());
  if (!m) return null;
  const rest = m[1]!.trim();
  if (!rest) return { amount: null };
  const amount = parseBareAmount(rest);
  return amount === null ? null : { amount };
}

export type BalanceVerdict = "MATCH" | "MISSING" | "EXTRA";

// gap = expected − actual. Small differences are rounding and forgotten
// paise, not a finding: under ₹100 or 1% of the balance counts as a match.
export function balanceVerdict(
  expected: number,
  actual: number,
): { gap: number; verdict: BalanceVerdict } {
  const gap = expected - actual;
  const tolerance = Math.max(100, Math.abs(expected) * 0.01);
  if (Math.abs(gap) < tolerance) return { gap, verdict: "MATCH" };
  return { gap, verdict: gap > 0 ? "MISSING" : "EXTRA" };
}

export interface BalanceDeps {
  incomeRepository: Pick<IIncomeRepository, "sumForMonth" | "sumCarryForMonth">;
  expenseRepository: Pick<
    IExpenseRepository,
    "sumByBucketForMonth" | "sumByCategoryForMonth"
  >;
  categoryRepository: Pick<ICategoryRepository, "findByNameForUser">;
  boxRepository: Pick<IBoxRepository, "sumMovedSince">;
}

export interface BalanceUser {
  id: string;
  balanceAnchor: unknown;
  balanceAnchorAt: Date | null;
}

export interface ExpectedBalance {
  anchor: number;
  anchorAt: Date;
  income: number;
  spent: number;
  expected: number;
}

const BUCKETS: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// What the balance should be now: anchor + income − spend since the anchor.
// Carry-forward rows ("Opening Balance" income, "Carried Forward" expense) are
// bookkeeping between cycles, not cash moving, so both are left out. Money
// moved into a box soft-deletes its Expense/Income, so it is added back.
// ponytail: manual box IN/OUT is ignored — boxes are virtual jars, the cash
// hasn't left the account. Revisit if boxes ever map to real accounts.
export async function expectedBalance(
  deps: BalanceDeps,
  user: BalanceUser,
  now: Date = new Date(),
): Promise<ExpectedBalance | null> {
  if (user.balanceAnchor == null || !user.balanceAnchorAt) return null;
  const from = user.balanceAnchorAt;
  const anchor = Number(user.balanceAnchor);

  const carryCat = await deps.categoryRepository.findByNameForUser(
    user.id,
    CARRY_EXPENSE_CATEGORY,
  );
  const carryId =
    carryCat &&
    carryCat.name.toLowerCase() === CARRY_EXPENSE_CATEGORY.toLowerCase()
      ? carryCat.id
      : null;

  const [gross, carryIn, buckets, carried, moved] = await Promise.all([
    deps.incomeRepository.sumForMonth(user.id, from, now),
    deps.incomeRepository.sumCarryForMonth(user.id, from, now),
    Promise.all(
      BUCKETS.map((b) =>
        deps.expenseRepository.sumByBucketForMonth(user.id, b, from, now),
      ),
    ),
    carryId
      ? deps.expenseRepository.sumByCategoryForMonth(
          user.id,
          carryId,
          from,
          now,
        )
      : 0,
    deps.boxRepository.sumMovedSince(user.id, from, now),
  ]);

  const income = gross - carryIn + moved.income;
  const spent = buckets.reduce((a, b) => a + b, 0) - carried + moved.spent;
  return {
    anchor,
    anchorAt: from,
    income,
    spent,
    expected: anchor + income - spent,
  };
}
