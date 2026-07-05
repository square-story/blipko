import { Bucket, Expense, Income, User } from "@prisma/client";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { InlineButtonRows } from "../interfaces/IMessagingPlatform";
import { resolveExpenseCategory } from "./expenseFlow";
import { TxnKind, txnCb } from "./txnCallback";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "./budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };

export interface TxnActionDeps {
  expenseRepository: IExpenseRepository;
  incomeRepository: IIncomeRepository;
  categoryRepository: ICategoryRepository;
  budgetConfigRepository: IBudgetConfigRepository;
}

// A resolved transaction the user is acting on, tagged by table.
export type TransactionRef =
  | { kind: "expense"; row: Expense }
  | { kind: "income"; row: Income };

// The edit staged in a ParseLog row between the confirm prompt and the tap.
export interface PendingEditPayload {
  action: "txn-edit";
  kind: TxnKind;
  targetId: string;
  amount?: number;
  categoryName?: string;
  note?: string | null;
  bucket?: Bucket;
  source?: string;
}

// ── Resolution ────────────────────────────────────────────────────────────────

export async function resolveByConfirmationMessage(
  deps: TxnActionDeps,
  userId: string,
  messageId: string,
): Promise<TransactionRef | null> {
  const expense = await deps.expenseRepository.findByConfirmationMessageId(
    messageId,
    userId,
  );
  if (expense) return { kind: "expense", row: expense };
  const income = await deps.incomeRepository.findByConfirmationMessageId(
    messageId,
    userId,
  );
  if (income) return { kind: "income", row: income };
  return null;
}

// Resolve by kind + id (used by callbacks). Returns the row even when
// soft-deleted, so restore can find it; ownership is enforced.
export async function resolveById(
  deps: TxnActionDeps,
  userId: string,
  kind: TxnKind,
  id: string,
): Promise<TransactionRef | null> {
  if (kind === "expense") {
    const row = await deps.expenseRepository.findById(id);
    return row && row.userId === userId ? { kind: "expense", row } : null;
  }
  const row = await deps.incomeRepository.findById(id);
  return row && row.userId === userId ? { kind: "income", row } : null;
}

// ── Descriptions ──────────────────────────────────────────────────────────────

// Compact one-line description, e.g. "₹200 · Wants · Chai" or "income ₹50,000 · salary".
export async function describeTxn(
  deps: TxnActionDeps,
  ref: TransactionRef,
): Promise<string> {
  if (ref.kind === "expense") {
    const e = ref.row;
    const label = await expenseLabel(deps, e);
    return `${formatMoney(Number(e.amount))} · ${BUCKET_META[e.bucket].label} · ${sanitizeMd(label)}`;
  }
  const i = ref.row;
  const label = i.note ?? i.source ?? "income";
  return `income ${formatMoney(Number(i.amount))} · ${sanitizeMd(label)}`;
}

async function expenseLabel(deps: TxnActionDeps, e: Expense): Promise<string> {
  if (e.categoryId) {
    const cat = await deps.categoryRepository.findById(e.categoryId);
    if (cat) return cat.name;
  }
  return e.note ?? "expense";
}

// ── Delete / restore ────────────────────────────────────────────────────────

export async function deleteTransaction(
  deps: TxnActionDeps,
  user: User,
  ref: TransactionRef,
): Promise<string> {
  if (ref.row.batchId) return deleteBatch(deps, user, ref.row.batchId);
  if (ref.kind === "expense") {
    await deps.expenseRepository.softDelete(ref.row.id);
    const remaining = await bucketRemaining(deps, user, ref.row.bucket);
    const label = await expenseLabel(deps, ref.row);
    const meta = BUCKET_META[ref.row.bucket];
    return `🗑 Removed ${formatMoney(Number(ref.row.amount))} ${sanitizeMd(label)}. ${meta.label} left this month: ${formatMoney(remaining)}.`;
  }
  await deps.incomeRepository.softDelete(ref.row.id);
  const label = ref.row.note ? ` (${sanitizeMd(ref.row.note)})` : "";
  return `🗑 Removed income ${formatMoney(Number(ref.row.amount))}${label}.`;
}

export async function deleteBatch(
  deps: TxnActionDeps,
  user: User,
  batchId: string,
): Promise<string> {
  const expenses = await deps.expenseRepository.findByBatchId(batchId, user.id);
  const incomes = await deps.incomeRepository.findByBatchId(batchId, user.id);
  await deps.expenseRepository.softDeleteByBatchId(batchId, user.id);
  await deps.incomeRepository.softDeleteByBatchId(batchId, user.id);

  const count = expenses.length + incomes.length;
  const total =
    expenses.reduce((s, e) => s + Number(e.amount), 0) +
    incomes.reduce((s, i) => s + Number(i.amount), 0);
  const lines = [
    `🗑 Removed ${count} ${count === 1 ? "entry" : "entries"} (${formatMoney(total)} total).`,
  ];
  for (const bucket of [...new Set(expenses.map((e) => e.bucket))]) {
    const remaining = await bucketRemaining(deps, user, bucket);
    const meta = BUCKET_META[bucket];
    lines.push(
      `${meta.emoji} ${meta.label} left this month: ${formatMoney(remaining)}.`,
    );
  }
  return lines.join("\n");
}

export async function restoreTransaction(
  deps: TxnActionDeps,
  ref: TransactionRef,
): Promise<string> {
  if (ref.kind === "expense") {
    await deps.expenseRepository.restore(ref.row.id);
    const label = await expenseLabel(deps, ref.row);
    return `✅ Restored ${formatMoney(Number(ref.row.amount))} ${sanitizeMd(label)}.`;
  }
  await deps.incomeRepository.restore(ref.row.id);
  const label = ref.row.note ? ` (${sanitizeMd(ref.row.note)})` : "";
  return `✅ Restored income ${formatMoney(Number(ref.row.amount))}${label}.`;
}

export async function restoreBatch(
  deps: TxnActionDeps,
  user: User,
  batchId: string,
): Promise<string> {
  await deps.expenseRepository.restoreByBatchId(batchId, user.id);
  await deps.incomeRepository.restoreByBatchId(batchId, user.id);
  const count =
    (await deps.expenseRepository.findByBatchId(batchId, user.id)).length +
    (await deps.incomeRepository.findByBatchId(batchId, user.id)).length;
  return `✅ Restored ${count} ${count === 1 ? "entry" : "entries"}.`;
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export interface ExpenseEditChanges {
  amount?: number | undefined;
  categoryName?: string | undefined;
  note?: string | null | undefined;
  bucket?: Bucket | undefined;
}

export async function applyExpenseEdit(
  deps: TxnActionDeps,
  user: User,
  expense: Expense,
  changes: ExpenseEditChanges,
): Promise<string> {
  const data: {
    amount?: number;
    bucket?: Bucket;
    categoryId?: string | null;
    note?: string | null;
  } = {};
  let bucket = expense.bucket;
  let categoryLabel: string;

  if (changes.categoryName) {
    const resolved = await resolveExpenseCategory(
      deps.categoryRepository,
      user.id,
      changes.bucket ?? expense.bucket,
      changes.categoryName,
    );
    data.categoryId = resolved.categoryId ?? null;
    bucket = resolved.bucket;
    data.bucket = bucket;
    categoryLabel = resolved.categoryLabel;
  } else {
    if (changes.bucket) {
      bucket = changes.bucket;
      data.bucket = bucket;
    }
    categoryLabel = await expenseLabel(deps, expense);
  }

  if (changes.amount != null) data.amount = changes.amount;
  if (changes.note !== undefined) data.note = changes.note;

  await deps.expenseRepository.update(expense.id, data);

  const amount = changes.amount ?? Number(expense.amount);
  const remaining = await bucketRemaining(deps, user, bucket);
  const meta = BUCKET_META[bucket];
  return `✅ Updated → ${formatMoney(amount)} ${meta.label} · ${sanitizeMd(categoryLabel)}\n${meta.label} left this month: ${formatMoney(remaining)}`;
}

export interface IncomeEditChanges {
  amount?: number | undefined;
  note?: string | null | undefined;
  source?: string | null | undefined;
}

export async function applyIncomeEdit(
  deps: TxnActionDeps,
  income: Income,
  changes: IncomeEditChanges,
): Promise<string> {
  const data: {
    amount?: number;
    source?: string | null;
    note?: string | null;
  } = {};
  if (changes.amount != null) data.amount = changes.amount;
  // Note doubles as source, mirroring how income is first recorded.
  if (changes.note !== undefined) {
    data.note = changes.note;
    data.source = changes.source ?? changes.note;
  } else if (changes.source !== undefined) {
    data.source = changes.source;
  }

  await deps.incomeRepository.update(income.id, data);

  const amount = changes.amount ?? Number(income.amount);
  const noteVal = changes.note !== undefined ? changes.note : income.note;
  const label = noteVal ? ` (${sanitizeMd(noteVal)})` : "";
  return `✅ Updated income → ${formatMoney(amount)}${label}`;
}

// ── Keyboards ───────────────────────────────────────────────────────────────

export function deleteConfirmKeyboard(ref: TransactionRef): InlineButtonRows {
  const b = ref.row.batchId;
  return [
    [
      {
        id: b ? txnCb.delbatch(b, true) : txnCb.del(ref.kind, ref.row.id, true),
        title: "✅ Yes, delete",
      },
      {
        id: b
          ? txnCb.delbatch(b, false)
          : txnCb.del(ref.kind, ref.row.id, false),
        title: "❌ Keep",
      },
    ],
  ];
}

export function undoConfirmKeyboard(ref: TransactionRef): InlineButtonRows {
  const b = ref.row.batchId;
  return [
    [
      {
        id: b ? txnCb.delbatch(b, true) : txnCb.del(ref.kind, ref.row.id, true),
        title: "✅ Yes",
      },
      {
        id: b
          ? txnCb.delbatch(b, false)
          : txnCb.del(ref.kind, ref.row.id, false),
        title: "❌ No",
      },
    ],
  ];
}

export function editConfirmKeyboard(logId: string): InlineButtonRows {
  return [
    [
      { id: txnCb.edit(logId, true), title: "✅ Yes" },
      { id: txnCb.edit(logId, false), title: "❌ Cancel" },
    ],
  ];
}

export function restoreKeyboard(ref: TransactionRef): InlineButtonRows {
  const b = ref.row.batchId;
  return [
    [
      {
        id: b ? txnCb.restorebatch(b) : txnCb.restore(ref.kind, ref.row.id),
        title: "↩️ Undo",
      },
    ],
  ];
}

// ── Budget helper ─────────────────────────────────────────────────────────────

export async function bucketRemaining(
  deps: TxnActionDeps,
  user: User,
  bucket: Bucket,
): Promise<number> {
  const { start, end } = currentBudgetPeriod(user.payday);
  const spent = await deps.expenseRepository.sumByBucketForMonth(
    user.id,
    bucket,
    start,
    end,
  );
  const config =
    (await deps.budgetConfigRepository.findByUserId(user.id)) ?? DEFAULT_SPLIT;
  const income = effectiveMonthlyIncome(
    Number(user.monthlyIncome ?? 0),
    await deps.incomeRepository.sumForMonth(user.id, start, end),
  );
  return bucketBudget(income, config, bucket) - spent;
}
