import { Bucket } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IParseLogRepository } from "../../../domain/repositories/IParseLogRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import {
  TxnActionDeps,
  PendingEditPayload,
  describeTxn,
  deleteConfirmKeyboard,
  editConfirmKeyboard,
} from "../transactionActions";
import { BUCKET_META, formatMoney, sanitizeMd } from "../budgetMath";

const DELETE_WORDS = /\b(delete|remove|undo|scrap|cancel|wrong|mistake|del)\b/;
const MAX_EXPENSE = 10_000_000;
const MAX_INCOME = 1_000_000_000;
const UNKNOWN = { intent: "UNKNOWN" as const, confidence: 1 };

// Handles a reply to a transaction's confirmation message. Routes to a delete or
// an edit confirmation prompt (never acts directly). Gated on context.replyTarget,
// which the orchestrator resolves from the replied-to message id. Runs first in
// the post-parse list so a correction like "250 groceries" is treated as an edit,
// not logged as a new expense.
export class TransactionReplyProcessor implements MessageProcessor {
  private readonly deps: TxnActionDeps;

  constructor(
    expenseRepository: IExpenseRepository,
    incomeRepository: IIncomeRepository,
    categoryRepository: ICategoryRepository,
    budgetConfigRepository: IBudgetConfigRepository,
    private readonly parseLogRepository: IParseLogRepository,
    private readonly messageService: IMessagingPlatform,
  ) {
    this.deps = {
      expenseRepository,
      incomeRepository,
      categoryRepository,
      budgetConfigRepository,
    };
  }

  canHandle(context: ProcessContext): boolean {
    return !!context.replyTarget;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const ref = context.replyTarget!;
    const parsed = context.parsed;
    const text = context.textMessage.toLowerCase();

    // ── Delete ────────────────────────────────────────────────────────────────
    if (DELETE_WORDS.test(text) || parsed?.intent === "UNDO") {
      const body = `🗑 Delete this?\n${await describeTxn(this.deps, ref)}`;
      await this.messageService.sendInteractiveMessage(
        context.platformUserId,
        body,
        deleteConfirmKeyboard(ref),
        { replyToMessageId: context.replyToMessageId },
      );
      return { response: body, parsed: UNKNOWN };
    }

    // ── Edit ────────────────────────────────────────────────────────────────
    const max = ref.kind === "expense" ? MAX_EXPENSE : MAX_INCOME;
    const amount =
      typeof parsed?.amount === "number" &&
      parsed.amount > 0 &&
      parsed.amount <= max
        ? parsed.amount
        : undefined;
    const categoryName = ref.kind === "expense" ? parsed?.category : undefined;
    const note = parsed?.note;
    const bucket =
      ref.kind === "expense"
        ? (parsed?.bucket as Bucket | undefined)
        : undefined;

    const hasEdit =
      amount != null || !!categoryName || note != null || !!bucket;
    if (!hasEdit) {
      return this.reply(
        context,
        "Reply with a new amount or category to edit (e.g. `250` or `groceries`), or `delete` to remove.",
      );
    }

    // Batched entries can't be individually edited (which one?).
    if (ref.row.batchId) {
      return this.reply(
        context,
        "That was part of a multi-entry message. Reply `delete` to remove them, then re-add the corrected one.",
      );
    }

    // Stage the change, then confirm before applying.
    const payload: PendingEditPayload = {
      action: "txn-edit",
      kind: ref.kind,
      targetId: ref.row.id,
      ...(amount != null && { amount }),
      ...(categoryName && { categoryName }),
      ...(note != null && { note }),
      ...(bucket && { bucket }),
      ...(ref.kind === "income" && note != null && { source: note }),
    };
    const log = await this.parseLogRepository.create({
      rawText: `txn-edit:${ref.kind}:${ref.row.id}`,
      parsed: payload as unknown as Record<string, unknown>,
      confidence: 1,
      userId: context.user.id,
    });

    const changeParts: string[] = [];
    if (amount != null) changeParts.push(`amount ${formatMoney(amount)}`);
    if (categoryName) changeParts.push(`category ${sanitizeMd(categoryName)}`);
    if (bucket) changeParts.push(`bucket ${BUCKET_META[bucket].label}`);
    if (note != null) changeParts.push(`note "${sanitizeMd(note)}"`);

    const body = `✏️ Update this?\n${await describeTxn(this.deps, ref)}\n→ ${changeParts.join(", ")}`;
    await this.messageService.sendInteractiveMessage(
      context.platformUserId,
      body,
      editConfirmKeyboard(log.id),
      { replyToMessageId: context.replyToMessageId },
    );
    return { response: body, parsed: UNKNOWN };
  }

  private async reply(
    context: ProcessContext,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body,
    });
    return { response: body, parsed: UNKNOWN };
  }
}
