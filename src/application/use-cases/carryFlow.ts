import { Box, User } from "@prisma/client";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IIncomeCategoryRepository } from "../../domain/repositories/IIncomeCategoryRepository";
import { IBoxRepository } from "../../domain/repositories/IBoxRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { CARRY_INCOME_CATEGORY } from "../../domain/incomeCategoryTemplate";
import { formatMoney, sanitizeMd } from "./budgetMath";
import { boxProgressLine } from "./boxFlow";

// The SAVINGS leaf carried-forward money is filed under. Deliberately its own
// category and never a box-linked one: assigning a box-linked category to an
// expense makes the web edit path divert it into that box and soft-delete it,
// which would post the money a second time.
export const CARRY_EXPENSE_CATEGORY = "Carried Forward";

// A message that is nothing but a number. Deliberately strict: the moment this
// matches, the text stops being parsed as an expense, so "500" answers the
// carry question but "chai 500" still logs a chai.
const BARE_AMOUNT = /^\s*(?:₹|rs\.?\s*)?([\d,]+)(\.\d{1,2})?\s*$/i;

export function parseBareAmount(text: string): number | null {
  const m = BARE_AMOUNT.exec(text ?? "");
  if (!m) return null;
  // Indian grouping is normal here ("12,700"); the digits are what matter.
  const digits = m[1]!.replace(/,/g, "");
  if (!/^\d{1,9}$/.test(digits)) return null;
  const n = Math.round(Number(digits + (m[2] ?? "")));
  return n > 0 ? n : null;
}

export interface CarryFlowDeps {
  userRepository: IUserRepository;
  expenseRepository: IExpenseRepository;
  incomeRepository: IIncomeRepository;
  incomeCategoryRepository: IIncomeCategoryRepository;
  categoryRepository: ICategoryRepository;
  boxRepository: IBoxRepository;
}

// Reuse the user's own leaf if they already have one, otherwise make it. Named
// lookup rather than a seeded system row because system categories are only
// cloned into a user's taxonomy during onboarding, and this one appears later.
async function carryExpenseCategoryId(
  categoryRepository: ICategoryRepository,
  userId: string,
): Promise<string | undefined> {
  const existing = await categoryRepository.findByNameForUser(
    userId,
    CARRY_EXPENSE_CATEGORY,
  );
  if (existing) return existing.id;
  const created = await categoryRepository.create({
    userId,
    name: CARRY_EXPENSE_CATEGORY,
    bucket: "SAVINGS",
  });
  return created.id;
}

// Carried money is filed as a SAVINGS expense: it leaves the spendable pool and
// fills the savings bucket, which is exactly what the bucket is for.
//
// When a box is chosen the entry is LINKED to the expense and the expense stays
// LIVE — unlike the diversion path, which soft-deletes its source because that
// money never belonged to the budget. Keeping it live is what makes analytics
// count the amount once: the expense feeds `savingsBucket`, and the entry's
// sourceExpenseId keeps it out of `boxContributed`.
export async function settleCarryToSavings(
  deps: CarryFlowDeps,
  user: Pick<User, "id">,
  amount: number,
  box: Box | null,
): Promise<string> {
  const categoryId = await carryExpenseCategoryId(
    deps.categoryRepository,
    user.id,
  );
  const expense = await deps.expenseRepository.create({
    userId: user.id,
    amount,
    bucket: "SAVINGS",
    categoryId,
    note: CARRY_EXPENSE_CATEGORY,
    rawText: `carry forward ${amount} to savings`,
    confidence: 1,
  });

  if (!box) {
    return `💰 ${formatMoney(amount)} moved to savings.`;
  }

  await deps.boxRepository.addEntry({
    boxId: box.id,
    userId: user.id,
    amount,
    direction: "IN",
    source: "LINKED",
    note: CARRY_EXPENSE_CATEGORY,
    sourceExpenseId: expense.id,
  });
  const balance = await deps.boxRepository.balanceFor(box.id);
  const icon = box.icon ? `${box.icon} ` : "";
  return (
    `💰 ${formatMoney(amount)} → ${icon}${sanitizeMd(box.name)}\n` +
    `📦 ${boxProgressLine(box, balance)}`
  );
}

// Carried money as the new cycle's opening balance: an income row under the
// CARRY_INCOME_CATEGORY, which the budget basis adds on top of the expected
// salary floor (effectiveMonthlyIncome).
export async function settleCarryToOpening(
  deps: CarryFlowDeps,
  user: Pick<User, "id">,
  amount: number,
): Promise<string> {
  const categories = await deps.incomeCategoryRepository.findAllForUser(
    user.id,
  );
  const category = categories.find((c) => c.name === CARRY_INCOME_CATEGORY);
  await deps.incomeRepository.create({
    userId: user.id,
    amount,
    rawText: `carry forward ${amount} as opening balance`,
    confidence: 1,
    note: CARRY_INCOME_CATEGORY,
    categoryId: category?.id,
  });
  return `➡️ ${formatMoney(amount)} carried into this cycle — your budget grew by that much.`;
}
