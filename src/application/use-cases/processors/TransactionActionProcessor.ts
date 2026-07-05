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
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import { isTxnCallback, parseTxnCallback, txnCb } from "../txnCallback";
import {
  TxnActionDeps,
  PendingEditPayload,
  applyExpenseEdit,
  applyIncomeEdit,
  deleteBatch,
  deleteTransaction,
  describeTxn,
  restoreBatch,
  restoreTransaction,
  resolveById,
  deleteConfirmKeyboard,
  restoreKeyboard,
} from "../transactionActions";

const EXPIRED = "That entry expired — please try again.";

// Handles every `txn:` inline-button callback: the delete/edit confirmations,
// the [🗑 Delete]/[✏️ Edit] quick-action buttons, and the restore taps. Runs as a
// pre-parse processor so it short-circuits before the AI parser.
export class TransactionActionProcessor implements MessageProcessor {
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
    return isTxnCallback(context.textMessage);
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const cb = parseTxnCallback(context.textMessage);
    if (!cb) return this.expire(context);
    const { user } = context;

    switch (cb.action) {
      // [🗑 Delete] quick-action → show the delete confirmation.
      case "askdel": {
        const ref = await resolveById(this.deps, user.id, cb.kind, cb.id);
        if (!ref) return this.expire(context);
        const body = `🗑 Delete this?\n${await describeTxn(this.deps, ref)}`;
        await this.messageService.sendInteractiveMessage(
          context.platformUserId,
          body,
          deleteConfirmKeyboard(ref),
          { replyToMessageId: context.callbackMessageId },
        );
        return { response: body, parsed: UNKNOWN };
      }

      // [🗑 Delete all] quick-action on a batch summary → confirm deleting all.
      case "askdelbatch": {
        const [expenses, incomes] = await Promise.all([
          this.deps.expenseRepository.findByBatchId(cb.batchId, user.id),
          this.deps.incomeRepository.findByBatchId(cb.batchId, user.id),
        ]);
        const count = expenses.length + incomes.length;
        if (count === 0) return this.expire(context);
        const body = `🗑 Delete all ${count} ${count === 1 ? "entry" : "entries"} from that message?`;
        await this.messageService.sendInteractiveMessage(
          context.platformUserId,
          body,
          [
            [
              {
                id: txnCb.delbatch(cb.batchId, true),
                title: "✅ Yes, delete all",
              },
              { id: txnCb.delbatch(cb.batchId, false), title: "❌ Keep" },
            ],
          ],
          { replyToMessageId: context.callbackMessageId },
        );
        return { response: body, parsed: UNKNOWN };
      }

      // [✏️ Edit] quick-action → nudge to reply with the change.
      case "hintedit": {
        const body =
          "✏️ Reply to the transaction with the change — e.g. `250`, `groceries`, or `250 groceries`.";
        await this.messageService.sendInteractiveMessage(
          context.platformUserId,
          body,
          [],
          { replyToMessageId: context.callbackMessageId },
        );
        return { response: body, parsed: UNKNOWN, toast: "Reply to edit" };
      }

      // Delete confirmation result (single). Also used by the undo prompt.
      case "del": {
        if (!cb.yes) return this.resolvePrompt(context, "❌ Kept.", "Kept");
        const ref = await resolveById(this.deps, user.id, cb.kind, cb.id);
        if (!ref) return this.expire(context);
        const summary = await deleteTransaction(this.deps, user, ref);
        return this.resolvePrompt(
          context,
          summary,
          "Deleted ✔",
          restoreKeyboard(ref),
        );
      }

      // Delete confirmation result (batch).
      case "delbatch": {
        if (!cb.yes) return this.resolvePrompt(context, "❌ Kept.", "Kept");
        const summary = await deleteBatch(this.deps, user, cb.batchId);
        return this.resolvePrompt(context, summary, "Deleted ✔", [
          [{ id: txnCb.restorebatch(cb.batchId), title: "↩️ Undo" }],
        ]);
      }

      // Edit confirmation result. Changes are staged in a ParseLog row.
      case "edit": {
        if (!cb.yes)
          return this.resolvePrompt(context, "❌ Cancelled.", "Cancelled");
        const log = await this.parseLogRepository.findById(cb.logId);
        if (!log) return this.expire(context);
        const payload = log.parsed as unknown as PendingEditPayload;
        if (payload?.action !== "txn-edit") return this.expire(context);
        const ref = await resolveById(
          this.deps,
          user.id,
          payload.kind,
          payload.targetId,
        );
        if (!ref) return this.expire(context);

        const summary =
          ref.kind === "expense"
            ? await applyExpenseEdit(this.deps, user, ref.row, {
                amount: payload.amount,
                categoryName: payload.categoryName,
                note: payload.note,
                bucket: payload.bucket,
              })
            : await applyIncomeEdit(this.deps, ref.row, {
                amount: payload.amount,
                note: payload.note,
                source: payload.source,
              });
        return this.resolvePrompt(context, summary, "Updated ✔");
      }

      case "restore": {
        const ref = await resolveById(this.deps, user.id, cb.kind, cb.id);
        if (!ref) return this.expire(context);
        const summary = await restoreTransaction(this.deps, ref);
        return this.resolvePrompt(context, summary, "Restored ✔");
      }

      case "restorebatch": {
        const summary = await restoreBatch(this.deps, user, cb.batchId);
        return this.resolvePrompt(context, summary, "Restored ✔");
      }
    }
  }

  // Edit the prompt message in place (removing its buttons, or swapping in a
  // restore button), and toast the tap. Falls back to a fresh message.
  private async resolvePrompt(
    context: ProcessContext,
    body: string,
    toast: string,
    rows: InlineButtonRows = [],
  ): Promise<ProcessOutput> {
    if (
      context.callbackMessageId &&
      this.messageService.editInteractiveMessage
    ) {
      await this.messageService.editInteractiveMessage(
        context.platformUserId,
        context.callbackMessageId,
        body,
        rows,
      );
    } else {
      await this.messageService.sendInteractiveMessage(
        context.platformUserId,
        body,
        rows,
      );
    }
    return { response: body, parsed: UNKNOWN, toast };
  }

  private async expire(context: ProcessContext): Promise<ProcessOutput> {
    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: EXPIRED,
    });
    return { response: EXPIRED, parsed: UNKNOWN, toast: "Expired" };
  }
}

const UNKNOWN = { intent: "UNKNOWN" as const, confidence: 1 };
