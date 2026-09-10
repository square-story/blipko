import { Bucket } from "@prisma/client";
import { INCOME_CATEGORY_TEMPLATE } from "../../../domain/incomeCategoryTemplate";
import {
  IAssistantWriteTools,
  ProposalResult,
} from "../../../domain/services/IAssistantWriteTools";
import { IPendingActionRepository } from "../../../domain/repositories/IPendingActionRepository";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBoxRepository } from "../../../domain/repositories/IBoxRepository";
import { BUCKET_META, formatMoney } from "../budgetMath";
import { PENDING_ACTION_SCHEMAS } from "../../../domain/entities/PendingAction";

// Long enough to read the message and tap; short enough that a stale proposal
// can't be confirmed days later against a budget that has since moved on. The
// existing bkt: confirmations have no expiry at all.
const TTL_MINUTES = 30;

const BUCKETS: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// Explicit tag rather than an `"error" in x` check: the success arm of
// ProposalResult has no `error` key either, so `in` cannot discriminate it.
type ResolvedBucket =
  | { resolved: true; bucket: Bucket | undefined }
  | { resolved: false; failure: ProposalResult };

// Turns a model's intent to write into a PendingAction. Every reference it
// makes (box name, expense id, category, bucket) is resolved against real rows
// HERE — so a confirmed action can never apply to something invented, and an
// unresolvable reference comes back as a soft error with the valid options.
// The income taxonomy is 13 fixed system rows, seeded for every user, so it can
// be validated against the template without a repository round-trip.
function resolveIncomeCategoryName(name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  return INCOME_CATEGORY_TEMPLATE.find((c) => c.name.toLowerCase() === wanted)
    ?.name;
}

export class AssistantWriteTools implements IAssistantWriteTools {
  constructor(
    private readonly pendingActionRepository: IPendingActionRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly boxRepository: IBoxRepository,
  ) {}

  async proposeRecurring(
    userId: string,
    input: {
      kind: "INCOME" | "EXPENSE";
      amount: number;
      dayOfMonth: number;
      bucket?: string | undefined;
      category?: string | undefined;
      note?: string | undefined;
    },
  ): Promise<ProposalResult> {
    // Two taxonomies, and only `kind` says which one `category` meant. This
    // used to resolve every rule against the EXPENSE categories, so an income
    // rule could be staged with an expense category and inherit its bucket.
    let payload;
    if (input.kind === "INCOME") {
      const match = input.category
        ? resolveIncomeCategoryName(input.category)
        : undefined;
      if (input.category && !match) {
        return {
          ok: false,
          error: "unknown_income_category",
          message: `"${input.category}" is not one of the income categories.`,
          available_categories: INCOME_CATEGORY_TEMPLATE.map((c) => c.name),
        };
      }
      // No bucket: the 50/30/20 split is a property of spending.
      payload = {
        kind: input.kind,
        amount: input.amount,
        dayOfMonth: input.dayOfMonth,
        ...(match ? { incomeCategoryName: match } : {}),
        ...(input.note ? { note: input.note } : {}),
      };
    } else {
      const bucket = await this.resolveBucket(
        userId,
        input.bucket,
        input.category,
      );
      if (!bucket.resolved) return bucket.failure;

      payload = {
        kind: input.kind,
        amount: input.amount,
        dayOfMonth: input.dayOfMonth,
        ...(bucket.bucket ? { bucket: bucket.bucket } : {}),
        ...(input.category ? { categoryName: input.category } : {}),
        ...(input.note ? { note: input.note } : {}),
      };
    }

    const label = input.note ?? input.category ?? input.kind.toLowerCase();
    const summary =
      input.kind === "INCOME"
        ? `${formatMoney(input.amount)} income (${label}) on day ${input.dayOfMonth} every month`
        : `${formatMoney(input.amount)} for ${label} on day ${input.dayOfMonth} every month`;

    return this.stage(userId, "SET_RECURRING", payload, summary);
  }

  async proposeBoxMove(
    userId: string,
    input: {
      box: string;
      amount: number;
      direction: "IN" | "OUT";
      note?: string | undefined;
    },
  ): Promise<ProposalResult> {
    const box = await this.boxRepository.findByNameForUser(userId, input.box);
    if (!box) {
      const boxes = await this.boxRepository.listWithBalances(userId);
      return {
        ok: false,
        error: "unknown_box",
        message: `"${input.box}" is not one of the user's boxes.`,
        available_boxes: boxes.map((b) => b.name),
      };
    }

    const summary =
      input.direction === "IN"
        ? `Add ${formatMoney(input.amount)} to ${box.name}`
        : `Take ${formatMoney(input.amount)} out of ${box.name}`;

    return this.stage(
      userId,
      "BOX_MOVE",
      {
        boxName: box.name,
        amount: input.amount,
        direction: input.direction,
        ...(input.note ? { note: input.note } : {}),
      },
      summary,
    );
  }

  async proposeDeleteExpense(
    userId: string,
    input: { expenseId: string },
  ): Promise<ProposalResult> {
    const expense = await this.expenseRepository.findById(input.expenseId);
    if (!expense || expense.userId !== userId || expense.isDeleted) {
      return {
        ok: false,
        error: "expense_not_found",
        message:
          "No such expense. Call get_recent_expenses and use an id from its rows.",
      };
    }

    return this.stage(
      userId,
      "DELETE_EXPENSE",
      { expenseId: expense.id },
      `Delete ${formatMoney(Number(expense.amount))}${expense.note ? ` (${expense.note})` : ""}`,
    );
  }

  async proposeExpenseEdit(
    userId: string,
    input: {
      expenseId: string;
      amount?: number | undefined;
      bucket?: string | undefined;
      category?: string | undefined;
      note?: string | undefined;
    },
  ): Promise<ProposalResult> {
    const expense = await this.expenseRepository.findById(input.expenseId);
    if (!expense || expense.userId !== userId || expense.isDeleted) {
      return {
        ok: false,
        error: "expense_not_found",
        message:
          "No such expense. Call get_recent_expenses and use an id from its rows.",
      };
    }

    const bucket = await this.resolveBucket(
      userId,
      input.bucket,
      input.category,
    );
    if (!bucket.resolved) return bucket.failure;

    const changes: string[] = [];
    if (input.amount !== undefined) {
      changes.push(
        `amount ${formatMoney(Number(expense.amount))} → ${formatMoney(input.amount)}`,
      );
    }
    if (input.category) changes.push(`category → ${input.category}`);
    if (bucket.bucket)
      changes.push(`bucket → ${BUCKET_META[bucket.bucket].label}`);
    if (input.note) changes.push(`note → "${input.note}"`);

    if (changes.length === 0) {
      return {
        ok: false,
        error: "no_changes",
        message: "Nothing to change — send at least one new value.",
      };
    }

    return this.stage(
      userId,
      "EDIT_EXPENSE",
      {
        expenseId: expense.id,
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(bucket.bucket ? { bucket: bucket.bucket } : {}),
        ...(input.category ? { categoryName: input.category } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
      changes.join(", "),
    );
  }

  // A named category's own bucket wins over whatever the model guessed — the
  // same rule ExpenseProcessor applies when logging.
  private async resolveBucket(
    userId: string,
    bucket: string | undefined,
    category: string | undefined,
  ): Promise<ResolvedBucket> {
    if (category) {
      const row = await this.categoryRepository.findByNameForUser(
        userId,
        category,
      );
      if (!row) {
        const all = await this.categoryRepository.findAllForUser(userId);
        return {
          resolved: false,
          failure: {
            ok: false,
            error: "unknown_category",
            message: `"${category}" is not one of the user's categories.`,
            available_categories: all
              .filter((c) => !c.isGroup)
              .map((c) => c.name),
          },
        };
      }
      return { resolved: true, bucket: row.bucket };
    }

    if (bucket === undefined) return { resolved: true, bucket: undefined };
    if (!BUCKETS.includes(bucket as Bucket)) {
      return {
        resolved: false,
        failure: {
          ok: false,
          error: "invalid_bucket",
          message: `Bucket must be one of ${BUCKETS.join(", ")}.`,
        },
      };
    }
    return { resolved: true, bucket: bucket as Bucket };
  }

  private async stage(
    userId: string,
    kind: keyof typeof PENDING_ACTION_SCHEMAS,
    payload: unknown,
    summary: string,
  ): Promise<ProposalResult> {
    // Validate before storing as well as on read: a malformed proposal should
    // fail now, where the model can fix it, not at confirmation time.
    const parsed = PENDING_ACTION_SCHEMAS[kind].safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_proposal",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    const row = await this.pendingActionRepository.create({
      userId,
      kind,
      payload: parsed.data,
      summary,
      ttlMinutes: TTL_MINUTES,
    });

    return { ok: true, pendingId: row.id, summary };
  }
}
