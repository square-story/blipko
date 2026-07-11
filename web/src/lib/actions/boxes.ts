"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  boxSchema,
  boxEntrySchema,
  type BoxInput,
} from "@/lib/validations/box";
import type { BoxEntryInput } from "@/lib/validations/box";

export type BoxView = {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number | null;
  priority: number;
  isArchived: boolean;
  targetReachedAt: Date | null;
  categoryId: string | null;
  categoryName: string | null;
  balance: number;
};

export type BoxEntryView = {
  id: string;
  amount: number;
  direction: "IN" | "OUT";
  source: "MANUAL" | "LINKED";
  note: string | null;
  date: Date;
  // Set when this entry was created by moving a budget transaction here, so it
  // can be moved back. Null for direct/bot entries.
  movedFrom: "expense" | "income" | null;
};

export type BoxEntryFilters = {
  boxId: string;
  search?: string;
  direction?: string; // dot-joined, e.g. "IN.OUT"
  from?: string; // epoch ms
  to?: string; // epoch ms
};

// Σ IN − Σ OUT per box, over non-deleted entries.
async function balanceMap(boxIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (boxIds.length === 0) return map;
  const groups = await prisma.boxEntry.groupBy({
    by: ["boxId", "direction"],
    where: { boxId: { in: boxIds }, isDeleted: false },
    _sum: { amount: true },
  });
  for (const g of groups) {
    const signed = (g.direction === "IN" ? 1 : -1) * Number(g._sum.amount ?? 0);
    map.set(g.boxId, (map.get(g.boxId) ?? 0) + signed);
  }
  return map;
}

type BoxRow = Prisma.BoxGetPayload<{
  include: { category: { select: { name: true } } };
}>;

function toBoxView(b: BoxRow, balance: number): BoxView {
  return {
    id: b.id,
    name: b.name,
    icon: b.icon,
    targetAmount: b.targetAmount === null ? null : Number(b.targetAmount),
    priority: b.priority,
    isArchived: b.isArchived,
    targetReachedAt: b.targetReachedAt,
    categoryId: b.categoryId,
    categoryName: b.category?.name ?? null,
    balance,
  };
}

export async function getBoxes(archived = false): Promise<BoxView[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const boxes = await prisma.box.findMany({
    where: { userId: session.user.id, isArchived: archived },
    include: { category: { select: { name: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  const balances = await balanceMap(boxes.map((b) => b.id));

  return boxes.map((b) => toBoxView(b, balances.get(b.id) ?? 0));
}

// Single box (any archive state), scoped to the user — for the detail page.
export async function getBox(boxId: string): Promise<BoxView | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const box = await prisma.box.findFirst({
    where: { id: boxId, userId: session.user.id },
    include: { category: { select: { name: true } } },
  });
  if (!box) return null;
  const balances = await balanceMap([box.id]);
  return toBoxView(box, balances.get(box.id) ?? 0);
}

function buildEntriesWhere(
  userId: string,
  { boxId, search, direction, from, to }: BoxEntryFilters,
): Prisma.BoxEntryWhereInput {
  const where: Prisma.BoxEntryWhereInput = {
    userId,
    boxId,
    isDeleted: false,
    OR: search
      ? [
          { note: { contains: search, mode: "insensitive" } },
          { rawText: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  };

  if (direction) {
    const dirs = direction.split(".").filter(Boolean) as ("IN" | "OUT")[];
    if (dirs.length > 0) where.direction = { in: dirs };
  }

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(Number(from));
    if (to) where.date.lte = new Date(Number(to) + 86_399_999);
  }

  return where;
}

export async function getBoxEntries({
  boxId,
  page = 1,
  limit = 10,
  search = "",
  sort = "date.desc",
  direction,
  from,
  to,
}: {
  boxId: string;
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  direction?: string;
  from?: string;
  to?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      message: "Unauthorized",
      data: [] as BoxEntryView[],
      total: 0,
      pageCount: 0,
    };
  }

  limit = Math.min(Math.max(1, Math.floor(limit)), 100);
  page = Math.max(1, Math.floor(page));
  const skip = (page - 1) * limit;

  const ALLOWED_SORT = ["date", "amount", "createdAt"] as const;
  type SortField = (typeof ALLOWED_SORT)[number];
  const [rawField, rawOrder] = sort.split(".");
  const sortField: SortField = ALLOWED_SORT.includes(rawField as SortField)
    ? (rawField as SortField)
    : "date";
  const sortOrder: Prisma.SortOrder = rawOrder === "asc" ? "asc" : "desc";

  const where = buildEntriesWhere(session.user.id, {
    boxId,
    search,
    direction,
    from,
    to,
  });

  try {
    const [total, entries] = await Promise.all([
      prisma.boxEntry.count({ where }),
      prisma.boxEntry.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
    ]);
    const data: BoxEntryView[] = entries.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      direction: e.direction,
      source: e.source,
      note: e.note,
      date: e.date,
      movedFrom: e.sourceExpenseId
        ? "expense"
        : e.sourceIncomeId
          ? "income"
          : null,
    }));
    return { success: true, data, total, pageCount: Math.ceil(total / limit) };
  } catch (error) {
    console.error("Error fetching box entries:", error);
    return {
      success: false,
      message: "Failed to fetch box entries",
      data: [] as BoxEntryView[],
      total: 0,
      pageCount: 0,
    };
  }
}

// Monthly contributions (IN) vs withdrawals (OUT) for the last `months`.
export async function getBoxContributionTrend(
  boxId: string,
  months = 6,
): Promise<{ month: string; in: number; out: number }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Seed each month so gaps render as zero bars (mirrors analytics.ts).
  const map = new Map<string, { month: string; in: number; out: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    map.set(key, {
      month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      in: 0,
      out: 0,
    });
  }

  const entries = await prisma.boxEntry.findMany({
    where: {
      boxId,
      userId: session.user.id,
      isDeleted: false,
      date: { gte: start },
    },
    select: { amount: true, direction: true, date: true },
  });

  for (const e of entries) {
    const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    const row = map.get(key);
    if (!row) continue;
    if (e.direction === "IN") row.in += Number(e.amount);
    else row.out += Number(e.amount);
  }

  return [...map.values()];
}

// Aggregate monthly IN vs OUT across ALL the user's boxes for the last `months`
// — powers the analytics "box contributions" chart.
export async function getBoxesContributionTrend(
  months = 6,
): Promise<{ month: string; in: number; out: number }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const map = new Map<string, { month: string; in: number; out: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    map.set(key, {
      month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      in: 0,
      out: 0,
    });
  }

  const entries = await prisma.boxEntry.findMany({
    where: { userId: session.user.id, isDeleted: false, date: { gte: start } },
    select: { amount: true, direction: true, date: true },
  });

  for (const e of entries) {
    const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    const row = map.get(key);
    if (!row) continue;
    if (e.direction === "IN") row.in += Number(e.amount);
    else row.out += Number(e.amount);
  }

  return [...map.values()];
}

// Resolve an optional linked category: must be the user's own leaf category.
async function resolveLinkedCategory(
  userId: string,
  categoryId: string | undefined,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!categoryId) return { ok: true, id: null };
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) return { ok: false, error: "Category not found" };
  if (category.isGroup)
    return { ok: false, error: "Pick a specific category, not a group" };
  return { ok: true, id: category.id };
}

export async function createBox(
  input: BoxInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const parsed = boxSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  const data = parsed.data;

  const link = await resolveLinkedCategory(userId, data.categoryId);
  if (!link.ok) return { success: false, error: link.error };

  try {
    await prisma.box.create({
      data: {
        userId,
        name: data.name,
        icon: data.icon || null,
        targetAmount: data.targetAmount ?? null,
        priority: data.priority ?? 0,
        categoryId: link.id,
      },
    });
  } catch {
    return {
      success: false,
      error: "A box with that name (or linked category) already exists",
    };
  }

  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateBox(
  id: string,
  input: BoxInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const parsed = boxSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  const data = parsed.data;

  const box = await prisma.box.findFirst({ where: { id, userId } });
  if (!box) return { success: false, error: "Box not found" };

  const link = await resolveLinkedCategory(userId, data.categoryId);
  if (!link.ok) return { success: false, error: link.error };

  try {
    await prisma.box.update({
      where: { id },
      data: {
        name: data.name,
        icon: data.icon || null,
        targetAmount: data.targetAmount ?? null,
        priority: data.priority ?? box.priority,
        categoryId: link.id,
      },
    });
  } catch {
    return {
      success: false,
      error: "A box with that name (or linked category) already exists",
    };
  }

  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBox(id: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  // Entries cascade-delete with the box (schema onDelete: Cascade).
  await prisma.box.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archiveBox(
  id: string,
  archived = true,
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  await prisma.box.updateMany({
    where: { id, userId: session.user.id },
    data: { isArchived: archived },
  });
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard");
  return { success: true };
}

// Unarchive a box (restore it to the active list).
export async function restoreBox(id: string): Promise<{ success: boolean }> {
  return archiveBox(id, false);
}

async function addEntry(
  boxId: string,
  direction: "IN" | "OUT",
  input: BoxEntryInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const parsed = boxEntrySchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const box = await prisma.box.findFirst({ where: { id: boxId, userId } });
  if (!box) return { success: false, error: "Box not found" };

  await prisma.boxEntry.create({
    data: {
      boxId,
      userId,
      amount: parsed.data.amount,
      direction,
      source: "MANUAL",
      note: parsed.data.note || null,
    },
  });

  // Note: targetReachedAt is left for the bot cron sweep to stamp + notify, so
  // the "target reached" push still goes out for web-funded boxes.
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addToBox(boxId: string, input: BoxEntryInput) {
  return addEntry(boxId, "IN", input);
}

export async function spendFromBox(boxId: string, input: BoxEntryInput) {
  return addEntry(boxId, "OUT", input);
}

// Move an existing budget transaction into a box: write a BoxEntry and
// soft-delete the source transaction, atomically — mirroring
// divertExpenseToLinkedBox but for an explicitly chosen box. Expense → OUT
// (spend drawn from the box), income → IN (contribution). targetReachedAt is
// left to the box cron sweep (same as addEntry).
async function moveTransactionToBox(
  kind: "expense" | "income",
  transactionId: string,
  boxId: string,
  note?: string,
): Promise<{ success: boolean; error?: string; boxName?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  if (!transactionId || !boxId)
    return { success: false, error: "Missing transaction or box" };

  const box = await prisma.box.findFirst({
    where: { id: boxId, userId, isArchived: false },
  });
  if (!box) return { success: false, error: "Box not found" };

  const tx =
    kind === "expense"
      ? await prisma.expense.findFirst({
          where: { id: transactionId, userId, isDeleted: false },
        })
      : await prisma.income.findFirst({
          where: { id: transactionId, userId, isDeleted: false },
        });
  if (!tx)
    return { success: false, error: "Transaction not found or already moved" };

  const softDelete =
    kind === "expense"
      ? prisma.expense.update({
          where: { id: transactionId },
          data: { isDeleted: true, deletedAt: new Date() },
        })
      : prisma.income.update({
          where: { id: transactionId },
          data: { isDeleted: true, deletedAt: new Date() },
        });

  await prisma.$transaction([
    prisma.boxEntry.create({
      data: {
        boxId: box.id,
        userId,
        amount: tx.amount,
        direction: kind === "expense" ? "OUT" : "IN",
        source: "MANUAL",
        note: note ?? tx.note,
        date: tx.date,
        sourceExpenseId: kind === "expense" ? transactionId : null,
        sourceIncomeId: kind === "income" ? transactionId : null,
      },
    }),
    softDelete,
  ]);

  revalidatePath("/dashboard");
  revalidatePath(
    kind === "expense" ? "/dashboard/expenses" : "/dashboard/income",
  );
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/categories");

  return { success: true, boxName: box.name };
}

export async function moveExpenseToBox(
  expenseId: string,
  boxId: string,
  note?: string,
) {
  return moveTransactionToBox("expense", expenseId, boxId, note);
}

export async function moveIncomeToBox(
  incomeId: string,
  boxId: string,
  note?: string,
) {
  return moveTransactionToBox("income", incomeId, boxId, note);
}

// Reverse a "move to box": restore the source transaction to the budget and
// soft-delete the box entry, atomically. Only works for entries that carry
// provenance (created via moveExpenseToBox/moveIncomeToBox).
export async function moveBoxEntryBackToBudget(
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const entry = await prisma.boxEntry.findFirst({
    where: { id: entryId, userId, isDeleted: false },
  });
  if (!entry) return { success: false, error: "Entry not found" };

  // Narrow on the provenance field itself so `sourceId` is a plain string
  // (no non-null assertion needed).
  const provenance: { kind: "expense" | "income"; sourceId: string } | null =
    entry.sourceExpenseId
      ? { kind: "expense", sourceId: entry.sourceExpenseId }
      : entry.sourceIncomeId
        ? { kind: "income", sourceId: entry.sourceIncomeId }
        : null;
  if (!provenance)
    return {
      success: false,
      error: "This entry didn't come from a transaction",
    };
  const { kind, sourceId } = provenance;

  const source =
    kind === "expense"
      ? await prisma.expense.findFirst({ where: { id: sourceId, userId } })
      : await prisma.income.findFirst({ where: { id: sourceId, userId } });
  if (!source)
    return {
      success: false,
      error: "The original transaction no longer exists",
    };

  const restore =
    kind === "expense"
      ? prisma.expense.update({
          where: { id: sourceId },
          data: { isDeleted: false, deletedAt: null },
        })
      : prisma.income.update({
          where: { id: sourceId },
          data: { isDeleted: false, deletedAt: null },
        });

  await prisma.$transaction([
    prisma.boxEntry.update({
      where: { id: entryId },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
    restore,
  ]);

  revalidatePath("/dashboard");
  revalidatePath(
    kind === "expense" ? "/dashboard/expenses" : "/dashboard/income",
  );
  revalidatePath("/dashboard/boxes");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function deleteBoxEntry(
  id: string,
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  await prisma.boxEntry.updateMany({
    where: { id, userId: session.user.id, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  revalidatePath("/dashboard/boxes");
  return { success: true };
}

export async function deleteBoxEntries(
  ids: string[],
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };
  if (!ids.length) return { success: false, message: "No entries selected" };
  if (ids.length > 100)
    return { success: false, message: "Cannot delete more than 100 at once" };

  await prisma.boxEntry.updateMany({
    where: { id: { in: ids }, userId: session.user.id, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  revalidatePath("/dashboard/boxes");
  return { success: true };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportBoxEntriesCsv(
  filters: BoxEntryFilters,
): Promise<{ success: boolean; csv?: string; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const where = buildEntriesWhere(session.user.id, filters);
  const entries = await prisma.boxEntry.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const header = ["Date", "Amount", "Direction", "Source", "Note"];
  const rows = entries.map((e) =>
    [
      e.date.toISOString().split("T")[0],
      String(Number(e.amount)),
      e.direction,
      e.source,
      e.note ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return { success: true, csv: [header.join(","), ...rows].join("\n") };
}
