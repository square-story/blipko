import { User } from "@prisma/client";
import {
  IAiParser,
  ConversationTurn,
  CategoryHint,
} from "../../domain/services/IAiParser";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IExpenseRepository } from "../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../domain/repositories/IBudgetConfigRepository";
import { IParseLogRepository } from "../../domain/repositories/IParseLogRepository";
import { IIncomeRepository } from "../../domain/repositories/IIncomeRepository";
import { IIncomeCategoryRepository } from "../../domain/repositories/IIncomeCategoryRepository";
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IBoxRepository } from "../../domain/repositories/IBoxRepository";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository";
import { RunInTransaction } from "../../domain/repositories/UnitOfWork";
import { IFinancialQueryAgent } from "../../domain/services/IFinancialQueryAgent";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { ParsedData, ParsedBucket } from "../../domain/entities/ParsedData";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./processors/MessageProcessor";
import { ConfirmBucketProcessor } from "./processors/ConfirmBucketProcessor";
import { RecurringConfirmProcessor } from "./processors/RecurringConfirmProcessor";
import {
  ConnectAccountProcessor,
  buildConnectHandoff,
} from "./processors/ConnectAccountProcessor";
import { SettingsProcessor } from "./processors/SettingsProcessor";
import { HelpProcessor } from "./processors/HelpProcessor";
import { StatusProcessor } from "./processors/StatusProcessor";
import { ReportProcessor } from "./processors/ReportProcessor";
import { UndoProcessor } from "./processors/UndoProcessor";
import { BatchProcessor } from "./processors/BatchProcessor";
import { ExpenseProcessor } from "./processors/ExpenseProcessor";
import { IncomeProcessor } from "./processors/IncomeProcessor";
import { RecurringSetupProcessor } from "./processors/RecurringSetupProcessor";
import { QueryProcessor } from "./processors/QueryProcessor";
import { AssistantProcessor } from "./processors/AssistantProcessor";
import { PendingActionProcessor } from "./processors/PendingActionProcessor";
import { IAssistantAgent } from "../../domain/services/IAssistantAgent";
import { IPendingActionRepository } from "../../domain/repositories/IPendingActionRepository";
import { FallbackProcessor } from "./processors/FallbackProcessor";
import { zonedYmd } from "../../utils/time";
import { logger } from "../../utils/logger";
import { describeError } from "../../utils/describeError";
import { BoxProcessor } from "./processors/BoxProcessor";
import { BoxCommandProcessor } from "./processors/BoxCommandProcessor";
import { RecurringCommandProcessor } from "./processors/RecurringCommandProcessor";
import { TransactionActionProcessor } from "./processors/TransactionActionProcessor";
import { TransactionReplyProcessor } from "./processors/TransactionReplyProcessor";
import { resolveByConfirmationMessage } from "./transactionActions";

export interface ProcessIncomingMessageInput {
  platformUserId: string;
  textMessage: string;
  platformUsername?: string | undefined;
  replyToMessageId?: string | undefined;
  // The message_id of the inline-keyboard message, when this is a button press —
  // lets processors edit that message in place (e.g. multi-select toggles).
  callbackMessageId?: string | undefined;
  // The callback_query id, so a handler can ack the tap with a toast.
  callbackQueryId?: string | undefined;
}

export interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
  // Optional toast to show on the tapped inline button (callbacks only).
  toast?: string | undefined;
}

export class ProcessIncomingMessageUseCase {
  // Processors that run before AI parsing (button callbacks, onboarding).
  private readonly preParseProcessors: MessageProcessor[];
  // Processors that run after AI parsing.
  private readonly postParseProcessors: MessageProcessor[];

  constructor(
    private readonly aiParser: IAiParser,
    private readonly userRepository: IUserRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly parseLogRepository: IParseLogRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly incomeCategoryRepository: IIncomeCategoryRepository,
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly boxRepository: IBoxRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly queryAgent: IFinancialQueryAgent,
    private readonly runTransaction: RunInTransaction,
    private readonly webAppUrl: string,
    // Null when the assistant lane is off — QueryProcessor then answers as before.
    private readonly assistantAgent: IAssistantAgent | null = null,
    private readonly pendingActionRepository: IPendingActionRepository | null = null,
  ) {
    this.preParseProcessors = [
      // Confirmations for assistant-proposed writes. First, and before any AI:
      // a button press is an answer to a question already asked.
      ...(pendingActionRepository
        ? [
            new PendingActionProcessor(
              pendingActionRepository,
              expenseRepository,
              categoryRepository,
              boxRepository,
              recurringRuleRepository,
              messageService,
              incomeCategoryRepository,
            ),
          ]
        : []),
      new TransactionActionProcessor(
        expenseRepository,
        incomeRepository,
        categoryRepository,
        budgetConfigRepository,
        parseLogRepository,
        messageService,
      ),
      new ConfirmBucketProcessor(
        parseLogRepository,
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
      new RecurringConfirmProcessor(
        recurringRuleRepository,
        expenseRepository,
        incomeRepository,
        categoryRepository,
        messageService,
        runTransaction,
        boxRepository,
      ),
      new ConnectAccountProcessor(messageService, webAppUrl),
      new SettingsProcessor(userRepository, messageService),
      new HelpProcessor(messageService, webAppUrl),
      new StatusProcessor(
        expenseRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
      new ReportProcessor(
        expenseRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
      new BoxCommandProcessor(boxRepository, messageService),
      new RecurringCommandProcessor(recurringRuleRepository, messageService),
      new UndoProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
    ];
    this.postParseProcessors = [
      new TransactionReplyProcessor(
        expenseRepository,
        incomeRepository,
        categoryRepository,
        budgetConfigRepository,
        parseLogRepository,
        messageService,
      ),
      new StatusProcessor(
        expenseRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
      new UndoProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
      new BatchProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        parseLogRepository,
        incomeRepository,
        messageService,
      ),
      new ExpenseProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        parseLogRepository,
        incomeRepository,
        boxRepository,
        messageService,
      ),
      new IncomeProcessor(
        incomeRepository,
        budgetConfigRepository,
        messageService,
      ),
      new RecurringSetupProcessor(
        recurringRuleRepository,
        categoryRepository,
        messageService,
      ),
      new BoxProcessor(boxRepository, messageService),
      // Assistant lane first; it yields when unconfigured so QueryProcessor
      // stays the answer path until the lane is switched on.
      new AssistantProcessor(this.assistantAgent, messageService, webAppUrl),
      new QueryProcessor(queryAgent, messageService, webAppUrl),
      new FallbackProcessor(messageService),
    ];
  }

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const linkToken = payload.textMessage?.match(/^\/?\s*start\s+(\S+)/i)?.[1];
    const { user, wasLinked } = await this.ensureUserExists(
      payload.platformUserId,
      linkToken,
    );

    if (wasLinked) {
      return {
        response: "✅ Account linked!",
        parsed: { intent: "UNKNOWN", confidence: 1 },
      };
    }

    // Brand-new, unlinked Telegram user — no account exists and no row was
    // created. Hand off to the web dashboard instead of onboarding in chat.
    if (!user) {
      const { body, rows } = buildConnectHandoff(this.webAppUrl);
      await this.messageService.sendInteractiveMessage(
        payload.platformUserId,
        body,
        rows,
      );
      return {
        response: body,
        parsed: { intent: "UNKNOWN", confidence: 1 },
      };
    }

    const historyRows = await this.conversationRepository.getRecent(user.id, 6);
    const history: ConversationTurn[] = historyRows.map((h) => ({
      role: h.role === "model" ? "model" : "user",
      content: h.content,
    }));

    // If the user replied to a transaction's confirmation message, resolve which
    // transaction so the reply/edit processors can gate on it synchronously.
    const replyTarget = payload.replyToMessageId
      ? await resolveByConfirmationMessage(
          {
            expenseRepository: this.expenseRepository,
            incomeRepository: this.incomeRepository,
            categoryRepository: this.categoryRepository,
            budgetConfigRepository: this.budgetConfigRepository,
          },
          user.id,
          payload.replyToMessageId,
        )
      : null;

    const context: ProcessContext = {
      user,
      platformUserId: payload.platformUserId,
      textMessage: payload.textMessage,
      replyToMessageId: payload.replyToMessageId,
      callbackMessageId: payload.callbackMessageId,
      callbackQueryId: payload.callbackQueryId,
      replyTarget: replyTarget ?? undefined,
      conversationHistory: history,
    };

    // Pre-AI processors (button callbacks, onboarding).
    for (const processor of this.preParseProcessors) {
      if (processor.canHandle(context)) {
        const output = await processor.process(context);
        // Record these too. Skipping them left /status, /report and every
        // button press missing from the transcript the model reads back, so a
        // follow-up referred to a conversation it could not see.
        this.recordExchange(user.id, payload.textMessage, output);
        return output;
      }
    }

    // AI parse with the user's category lists as context.
    const [categories, incomeCategories] = await Promise.all([
      this.loadCategoryHints(user.id),
      this.incomeCategoryRepository.findAllForUser(user.id),
    ]);
    context.incomeCategories = incomeCategories;
    const batch = await this.aiParser.parseText(payload.textMessage, {
      categories,
      incomeCategories: incomeCategories.map((c) => c.name),
      history,
      today: zonedYmd(new Date(), user.timezone),
      assistantMode: this.assistantAgent !== null,
    });

    if (batch.transactions.length >= 2) {
      // Multiple transactions in one message → BatchProcessor.
      context.parsedBatch = batch;
    } else {
      // Single transaction → today's behavior, byte-for-byte.
      context.parsed = batch.transactions[0] ?? {
        intent: "UNKNOWN",
        confidence: 0,
      };
    }

    for (const processor of this.postParseProcessors) {
      if (processor.canHandle(context)) {
        const output = await processor.process(context);
        this.recordExchange(user.id, payload.textMessage, output);
        return output;
      }
    }

    // FallbackProcessor.canHandle always returns true, so this is unreachable.
    throw new Error(
      `No processor handled intent: ${context.parsed?.intent ?? "BATCH"}`,
    );
  }

  // Fire-and-forget: history is context, not correctness, so a failed write
  // must never cost the user their reply. Ordering within the pair is handled
  // by the repository, not by the order these two lines happen to resolve in.
  private recordExchange(
    userId: string,
    userText: string,
    output: ProcessOutput,
  ): void {
    this.conversationRepository
      .appendExchange(userId, userText, output.historyText ?? output.response, {
        intent: output.parsed?.intent,
        ...output.turnMeta,
      })
      .catch((err) =>
        logger.error("Failed to record conversation turn", {
          component: "conversation",
          userId,
          err: describeError(err),
        }),
      );
  }

  private async loadCategoryHints(userId: string): Promise<CategoryHint[]> {
    const categories = await this.categoryRepository.findAllForUser(userId);
    return categories.map((c) => ({
      name: c.name,
      bucket: c.bucket as ParsedBucket,
    }));
  }

  private async ensureUserExists(
    telegramId: string,
    linkToken?: string,
  ): Promise<{ user: User | null; wasLinked: boolean }> {
    const existing = await this.userRepository.findByTelegramId(telegramId);
    // No link token: existing Telegram user is the user, as before.
    if (existing && !linkToken) return { user: existing, wasLinked: false };

    // A link token takes priority — even when a Telegram-only user already
    // exists — so linking merges it into the web account instead of leaving two
    // split rows (the bug where bot expenses never reach the dashboard).
    if (linkToken) {
      const linked = await this.userRepository.linkTelegramByToken(
        linkToken,
        telegramId,
      );
      if (linked) {
        await this.messageService.sendMessage({
          to: telegramId,
          body: `✅ Account linked! Text me what you spend — like "chai 30" — and I'll track your budget.`,
        });
        return { user: linked, wasLinked: true };
      }
    }

    // Token absent/expired but a Telegram user exists → use it.
    if (existing) return { user: existing, wasLinked: false };

    // Brand-new, unlinked, no token → do NOT create a row. The caller hands off
    // to the web dashboard; the account/link is created only via /start <token>
    // (which links onto the signed-in web account, so no duplicates).
    return { user: null, wasLinked: false };
  }
}
