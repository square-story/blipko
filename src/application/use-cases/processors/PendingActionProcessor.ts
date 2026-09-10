import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IPendingActionRepository } from "../../../domain/repositories/IPendingActionRepository";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBoxRepository } from "../../../domain/repositories/IBoxRepository";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { IIncomeCategoryRepository } from "../../../domain/repositories/IIncomeCategoryRepository";
import { resolveIncomeCategory } from "../../../domain/incomeCategoryTemplate";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { parseActCallback } from "../actCallback";
import { parsePendingPayload } from "../../../domain/entities/PendingAction";
import { recordBoxEntry } from "../boxFlow";
import { BUCKET_META, formatMoney } from "../budgetMath";
import { logger } from "../../../utils/logger";
import { describeError } from "../../../utils/describeError";

const EXPIRED =
  "That request expired or was already handled — ask me again and I'll set it up.";
const CANCELLED = "Cancelled — nothing changed.";

// Performs a write the assistant proposed, once the user taps Confirm.
//
// The split matters: the model decides WHAT to propose, this decides whether it
// is allowed and then does it. Ownership, expiry, single-use and payload shape
// are all re-checked here — the callback id being unguessable is not an
// authorization check.
export class PendingActionProcessor implements MessageProcessor {
  constructor(
    private readonly pendingActionRepository: IPendingActionRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly boxRepository: IBoxRepository,
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly incomeCategoryRepository: IIncomeCategoryRepository,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return parseActCallback(context.textMessage ?? "") !== null;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const callback = parseActCallback(context.textMessage)!;

    if (!callback.yes) {
      // Nothing was ever written, so cancelling is just consuming the row.
      await this.pendingActionRepository.consume(callback.pendingId, user.id);
      return this.reply(platformUserId, CANCELLED, context);
    }

    // Scoped to this user: another user's pending id must not resolve.
    const pending = await this.pendingActionRepository.findLiveForUser(
      callback.pendingId,
      user.id,
    );
    if (!pending) return this.reply(platformUserId, EXPIRED, context);

    const parsed = parsePendingPayload(pending.kind, pending.payload);
    if (!parsed) {
      logger.error("Pending action payload failed validation", {
        component: "assistant",
        userId: user.id,
        pendingActionId: pending.id,
        kind: pending.kind,
      });
      return this.reply(platformUserId, EXPIRED, context);
    }

    // Claim it BEFORE writing: a double-tap must not apply the same change
    // twice, and losing the race means someone else already did the work.
    const claimed = await this.pendingActionRepository.consume(
      pending.id,
      user.id,
    );
    if (!claimed) return this.reply(platformUserId, EXPIRED, context);

    try {
      const body = await this.apply(parsed, user.id);
      return this.reply(platformUserId, body, context);
    } catch (error) {
      logger.error("Failed to apply pending action", {
        component: "assistant",
        userId: user.id,
        pendingActionId: pending.id,
        kind: pending.kind,
        err: describeError(error),
      });
      return this.reply(
        platformUserId,
        "Something went wrong applying that — nothing was changed.",
        context,
      );
    }
  }

  private async apply(
    parsed: NonNullable<ReturnType<typeof parsePendingPayload>>,
    userId: string,
  ): Promise<string> {
    switch (parsed.kind) {
      case "SET_RECURRING": {
        const p = parsed.data as {
          kind: "INCOME" | "EXPENSE";
          amount: number;
          dayOfMonth: number;
          bucket?: "NEEDS" | "WANTS" | "SAVINGS";
          categoryName?: string;
          incomeCategoryName?: string;
          note?: string;
        };
        // Two taxonomies. This used to resolve against the EXPENSE categories
        // whatever the kind, so an income rule could be handed an expense
        // category and inherit its bucket.
        if (p.kind === "INCOME") {
          const incomeCategory = resolveIncomeCategory(
            await this.incomeCategoryRepository.findAllForUser(userId),
            p.incomeCategoryName,
          );
          await this.recurringRuleRepository.create({
            userId,
            kind: "INCOME",
            amount: p.amount,
            dayOfMonth: p.dayOfMonth,
            incomeCategoryId: incomeCategory?.id,
            note: p.note,
          });
          return `🔁 Set up: ${formatMoney(p.amount)} income on day ${p.dayOfMonth} every month.`;
        }
        const category = p.categoryName
          ? await this.categoryRepository.findByNameForUser(
              userId,
              p.categoryName,
            )
          : null;
        await this.recurringRuleRepository.create({
          userId,
          kind: p.kind,
          amount: p.amount,
          dayOfMonth: p.dayOfMonth,
          // A named category's own bucket is authoritative, exactly as when
          // logging an expense.
          bucket: category?.bucket ?? p.bucket,
          categoryId: category?.id,
          note: p.note,
        });
        return `🔁 Set up: ${formatMoney(p.amount)} expense on day ${p.dayOfMonth} every month.`;
      }

      case "BOX_MOVE": {
        const p = parsed.data as {
          boxName: string;
          amount: number;
          direction: "IN" | "OUT";
          note?: string;
        };
        const box = await this.boxRepository.findByNameForUser(
          userId,
          p.boxName,
        );
        if (!box) return EXPIRED;
        const { balance } = await recordBoxEntry(this.boxRepository, {
          box,
          userId,
          amount: p.amount,
          direction: p.direction,
          note: p.note,
        });
        const verb = p.direction === "IN" ? "Added" : "Withdrew";
        return `📦 ${verb} ${formatMoney(p.amount)} ${p.direction === "IN" ? "to" : "from"} ${box.name}. Balance: ${formatMoney(balance)}.`;
      }

      case "DELETE_EXPENSE": {
        const p = parsed.data as { expenseId: string };
        const expense = await this.expenseRepository.findById(p.expenseId);
        // Re-check ownership at apply time: the proposal may be 30 minutes old.
        if (!expense || expense.userId !== userId || expense.isDeleted) {
          return EXPIRED;
        }
        await this.expenseRepository.softDelete(expense.id);
        return `🗑 Deleted ${formatMoney(Number(expense.amount))}${expense.note ? ` (${expense.note})` : ""}.`;
      }

      case "EDIT_EXPENSE": {
        const p = parsed.data as {
          expenseId: string;
          amount?: number;
          bucket?: "NEEDS" | "WANTS" | "SAVINGS";
          categoryName?: string;
          note?: string;
        };
        const expense = await this.expenseRepository.findById(p.expenseId);
        if (!expense || expense.userId !== userId || expense.isDeleted) {
          return EXPIRED;
        }
        const category = p.categoryName
          ? await this.categoryRepository.findByNameForUser(
              userId,
              p.categoryName,
            )
          : null;
        await this.expenseRepository.update(expense.id, {
          amount: p.amount,
          bucket: category?.bucket ?? p.bucket,
          categoryId: category?.id,
          note: p.note,
        });

        const bits = [
          p.amount !== undefined ? formatMoney(p.amount) : null,
          category ? category.name : null,
          (category?.bucket ?? p.bucket)
            ? BUCKET_META[(category?.bucket ?? p.bucket)!].label
            : null,
        ].filter(Boolean);
        return `✏️ Updated${bits.length ? `: ${bits.join(" · ")}` : ""}.`;
      }
    }
  }

  private async reply(
    to: string,
    body: string,
    context: ProcessContext,
  ): Promise<ProcessOutput> {
    if (context.callbackQueryId && this.messageService.acknowledgeInteraction) {
      await this.messageService.acknowledgeInteraction(context.callbackQueryId);
    }
    await this.messageService.sendMessage({ to, body });
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}
