"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateId } from "@/lib/id";
import { INCOME_FALLBACK_CATEGORY } from "@/lib/budget";
import { DEFAULT_TZ, zonedYmd } from "@/lib/time";
import { divertExpenseToLinkedBox } from "@/lib/box-transfer";
import {
  findRememberedCategories,
  phraseMemoryKey,
  rememberCategoryChoice,
} from "@/lib/category-memory";
import {
  type LoggedRow,
  defaultInclude,
  importDate,
  markDuplicates,
} from "@/lib/import/statement";

// Statement import. The file is parsed in the browser (lib/import); only the
// normalised rows reach these actions, and they are re-validated here because
// a server action is a public endpoint.

const MAX_ROWS = 1000;
// Mirrors UNTRACKED_CATEGORY in src/application/use-cases/carryFlow.ts.
const UNTRACKED_CATEGORY = "Untracked";
const DAY_MS = 86_400_000;

const txnSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(10_000_000),
  kind: z.enum(["DEBIT", "CREDIT"]),
  narration: z.string().max(500),
  payee: z.string().min(1).max(100),
  cash: z.boolean(),
  cardBill: z.boolean(),
});
const txnsSchema = z.array(txnSchema).min(1).max(MAX_ROWS);

const commitSchema = z
  .array(
    z.object({
      txn: txnSchema,
      categoryId: z.string().min(1).max(50).nullish(),
      incomeCategoryId: z.string().min(1).max(50).nullish(),
    }),
  )
  .min(1)
  .max(MAX_ROWS);

export type ImportTxn = z.infer<typeof txnSchema>;
export type CommitRow = z.infer<typeof commitSchema>[number];

export interface PreviewRow {
  duplicate: boolean;
  categoryId: string | null;
  include: boolean;
}

type Result<T> = ({ success: true } & T) | { success: false; message: string };

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, timezone: true },
  });
  return user && { id: user.id, tz: user.timezone || DEFAULT_TZ };
}

function revalidateAll(): void {
  for (const path of [
    "/dashboard",
    "/dashboard/expenses",
    "/dashboard/income",
    "/dashboard/categories",
    "/dashboard/analytics",
    "/dashboard/boxes",
  ]) {
    revalidatePath(path);
  }
}

// The statement's date window in the user's zone, padded so a ±1 day match
// at either end is still seen.
function statementRange(tz: string, dates: string[]) {
  const sorted = [...dates].sort();
  return {
    gte: new Date(importDate(sorted[0]!, tz).getTime() - 2 * DAY_MS),
    lt: new Date(importDate(sorted.at(-1)!, tz).getTime() + 2 * DAY_MS),
  };
}

// What's already logged around the statement's dates, as day keys in the
// user's zone. Moving a transaction into a box — the bot's linked-category
// diversion or the dashboard's "Move to box" — soft-deletes it, so its box
// entry stands in for it; otherwise re-importing it would look new.
async function loggedRows(
  userId: string,
  tz: string,
  range: { gte: Date; lt: Date },
): Promise<LoggedRow[]> {
  const moved = { userId, isDeleted: false, isTracking: false, date: range };
  const [expenses, incomes, movedOut, movedIn] = await Promise.all([
    prisma.expense.findMany({
      where: { userId, isDeleted: false, date: range },
      select: { date: true, amount: true },
    }),
    prisma.income.findMany({
      where: { userId, isDeleted: false, date: range },
      select: { date: true, amount: true },
    }),
    prisma.boxEntry.findMany({
      where: {
        ...moved,
        direction: "OUT",
        OR: [{ source: "LINKED" }, { sourceExpenseId: { not: null } }],
      },
      select: { date: true, amount: true },
    }),
    prisma.boxEntry.findMany({
      where: { ...moved, direction: "IN", sourceIncomeId: { not: null } },
      select: { date: true, amount: true },
    }),
  ]);
  const row =
    (kind: LoggedRow["kind"]) => (r: { date: Date; amount: unknown }) => ({
      date: zonedYmd(r.date, tz),
      amount: Number(r.amount),
      kind,
    });
  return [
    ...expenses.map(row("DEBIT")),
    ...movedOut.map(row("DEBIT")),
    ...incomes.map(row("CREDIT")),
    ...movedIn.map(row("CREDIT")),
  ];
}

export async function previewImport(
  input: ImportTxn[],
): Promise<Result<{ rows: PreviewRow[]; untracked: number }>> {
  const user = await sessionUser();
  if (!user) return { success: false, message: "Unauthorized" };
  const parsed = txnsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid statement rows",
    };
  }
  const txns = parsed.data;

  const range = statementRange(
    user.tz,
    txns.map((t) => t.date),
  );
  const [logged, untracked] = await Promise.all([
    loggedRows(user.id, user.tz, range),
    // A balance check's "Untracked" lump covers spends this statement lists
    // one by one; the preview says so, since they can't be matched.
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        isDeleted: false,
        date: range,
        category: { name: UNTRACKED_CATEGORY },
      },
      _sum: { amount: true },
    }),
  ]);
  const dup = markDuplicates(txns, logged);
  const keys = txns.map((t) => phraseMemoryKey(t.payee));
  const remembered = await findRememberedCategories(user.id, [
    ...new Set(keys.filter((k): k is string => !!k)),
  ]);

  return {
    success: true,
    untracked: Number(untracked._sum.amount ?? 0),
    rows: txns.map((t, i) => ({
      duplicate: dup[i]!,
      categoryId:
        t.kind === "DEBIT" ? (remembered.get(keys[i] ?? "") ?? null) : null,
      include: defaultInclude(t, dup[i]!),
    })),
  };
}

export async function commitImport(
  input: CommitRow[],
): Promise<Result<{ batchId: string; expenses: number; income: number }>> {
  const user = await sessionUser();
  if (!user) return { success: false, message: "Unauthorized" };
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid import",
    };
  }
  const debits = parsed.data.filter((r) => r.txn.kind === "DEBIT");
  const credits = parsed.data.filter((r) => r.txn.kind === "CREDIT");

  // Every category id came from the browser: resolve them against the user's
  // own leaves (expenses) and the shared + own income taxonomy.
  const catIds = [
    ...new Set(debits.map((r) => r.categoryId).filter((c): c is string => !!c)),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: catIds }, userId: user.id, isGroup: false },
    select: { id: true, bucket: true },
  });
  if (categories.length !== catIds.length) {
    return { success: false, message: "Unknown category — refresh and retry." };
  }
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket]));

  const incomeCats = await prisma.incomeCategory.findMany({
    where: { OR: [{ userId: null }, { userId: user.id }] },
    select: { id: true, name: true, userId: true },
  });
  const incomeIds = new Set(incomeCats.map((c) => c.id));
  const fallback =
    incomeCats.find(
      (c) => c.name === INCOME_FALLBACK_CATEGORY && c.userId === user.id,
    ) ?? incomeCats.find((c) => c.name === INCOME_FALLBACK_CATEGORY);
  if (
    credits.some(
      (r) => r.incomeCategoryId && !incomeIds.has(r.incomeCategoryId),
    )
  ) {
    return {
      success: false,
      message: "Unknown income category — refresh and retry.",
    };
  }

  const batchId = generateId({ length: 16 });
  const rawText = (narration: string) => `[import] ${narration}`.slice(0, 500);

  const [created] = await prisma.$transaction([
    prisma.expense.createManyAndReturn({
      data: debits.map(({ txn, categoryId }) => ({
        userId: user.id,
        amount: txn.amount,
        bucket: (categoryId && bucketOf.get(categoryId)) || "WANTS",
        categoryId: categoryId ?? null,
        note: txn.payee,
        rawText: rawText(txn.narration),
        source: "IMPORT" as const,
        // Uncategorised rows land in the dashboard's needs-review inbox.
        confidence: categoryId ? 1 : 0.5,
        date: importDate(txn.date, user.tz),
        batchId,
      })),
      select: {
        id: true,
        categoryId: true,
        amount: true,
        note: true,
        date: true,
      },
    }),
    prisma.income.createMany({
      data: credits.map(({ txn, incomeCategoryId }) => ({
        userId: user.id,
        amount: txn.amount,
        categoryId: incomeCategoryId ?? fallback?.id ?? null,
        note: txn.payee,
        rawText: rawText(txn.narration),
        confidence: 1,
        date: importDate(txn.date, user.tz),
        batchId,
      })),
    }),
  ]);

  // A spend in a box-linked category moves into that box, same as when it is
  // categorised anywhere else on the dashboard.
  const linked = new Set(
    (
      await prisma.box.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          categoryId: { in: catIds },
        },
        select: { categoryId: true },
      })
    ).map((b) => b.categoryId),
  );
  for (const e of created) {
    if (e.categoryId && linked.has(e.categoryId)) {
      await divertExpenseToLinkedBox(user.id, {
        expenseId: e.id,
        categoryId: e.categoryId,
        amount: Number(e.amount),
        note: e.note,
        date: e.date,
      });
    }
  }

  // Teach the bot: next time this payee is filed the same way, in chat too.
  const taught = new Map<string, string>();
  for (const { txn, categoryId } of debits) {
    if (categoryId) taught.set(txn.payee, categoryId);
  }
  for (const [payee, categoryId] of taught) {
    await rememberCategoryChoice(user.id, payee, categoryId);
  }

  revalidateAll();
  return {
    success: true,
    batchId,
    expenses: debits.length,
    income: credits.length,
  };
}

export async function undoImport(
  batchId: string,
): Promise<Result<{ count: number }>> {
  const user = await sessionUser();
  if (!user) return { success: false, message: "Unauthorized" };
  const id = z.string().min(1).max(40).safeParse(batchId);
  if (!id.success) return { success: false, message: "Invalid import" };

  const where = { userId: user.id, batchId: id.data };
  const expenseIds = (
    await prisma.expense.findMany({ where, select: { id: true } })
  ).map((e) => e.id);
  const now = new Date();
  const [expenses, incomes, diverted] = await prisma.$transaction([
    prisma.expense.updateMany({
      where: { ...where, isDeleted: false },
      data: { isDeleted: true, deletedAt: now },
    }),
    prisma.income.updateMany({
      where: { ...where, isDeleted: false },
      data: { isDeleted: true, deletedAt: now },
    }),
    // Diverted rows: their expense is already soft-deleted; the box entry
    // carries the money, so it goes too.
    prisma.boxEntry.updateMany({
      where: {
        userId: user.id,
        sourceExpenseId: { in: expenseIds },
        isDeleted: false,
      },
      data: { isDeleted: true, deletedAt: now },
    }),
  ]);

  revalidateAll();
  // A diverted spend's expense was already soft-deleted; its box entry counts.
  return {
    success: true,
    count: expenses.count + incomes.count + diverted.count,
  };
}
