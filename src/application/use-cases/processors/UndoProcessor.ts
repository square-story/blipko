import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import {
  TxnActionDeps,
  TransactionRef,
  describeTxn,
  undoConfirmKeyboard,
} from "../transactionActions";

// Asks to confirm before removing an entry. Triggers on plain "undo"/"/undo"
// (pre-AI) or the UNDO intent (post-AI) — but NOT on replies, which the
// TransactionReplyProcessor handles against the specific replied-to transaction.
// The actual delete happens in TransactionActionProcessor when the user taps Yes
// (the confirm keyboard emits the shared txn:del/txn:delbatch callbacks).
export class UndoProcessor implements MessageProcessor {
  private readonly deps: TxnActionDeps;

  constructor(
    expenseRepository: IExpenseRepository,
    categoryRepository: ICategoryRepository,
    budgetConfigRepository: IBudgetConfigRepository,
    incomeRepository: IIncomeRepository,
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
    if (context.replyTarget) return false;
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    if (normalized === "undo") return true;
    return context.parsed?.intent === "UNDO";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { platformUserId } = context;

    const ref = await this.pickLatestEntry(context.user.id);
    if (!ref) {
      const body = "Nothing to undo yet — log a spend first.";
      await this.messageService.sendMessage({ to: platformUserId, body });
      return { response: body, parsed: { intent: "UNDO", confidence: 1 } };
    }

    const body = `↩️ Undo this?\n${await describeTxn(this.deps, ref)}`;
    await this.messageService.sendInteractiveMessage(
      platformUserId,
      body,
      undoConfirmKeyboard(ref),
    );
    return { response: body, parsed: { intent: "UNDO", confidence: 1 } };
  }

  // The most recent non-deleted entry across expenses + income.
  private async pickLatestEntry(
    userId: string,
  ): Promise<TransactionRef | null> {
    const expense = await this.deps.expenseRepository.findLastByUserId(userId);
    const income = await this.deps.incomeRepository.findLastByUserId(userId);
    if (!expense && !income) return null;
    if (expense && (!income || expense.date >= income.date)) {
      return { kind: "expense", row: expense };
    }
    return { kind: "income", row: income! };
  }
}
