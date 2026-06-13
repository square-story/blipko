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
import { IRecurringRuleRepository } from "../../domain/repositories/IRecurringRuleRepository";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository";
import { IFinancialQueryAgent } from "../../domain/services/IFinancialQueryAgent";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { ParsedData, ParsedBucket } from "../../domain/entities/ParsedData";
import {
  MessageProcessor,
  ProcessContext,
} from "./processors/MessageProcessor";
import { ConfirmBucketProcessor } from "./processors/ConfirmBucketProcessor";
import { RecurringConfirmProcessor } from "./processors/RecurringConfirmProcessor";
import { OnboardingProcessor } from "./processors/OnboardingProcessor";
import { SettingsProcessor } from "./processors/SettingsProcessor";
import { HelpProcessor } from "./processors/HelpProcessor";
import { StatusProcessor } from "./processors/StatusProcessor";
import { ReportProcessor } from "./processors/ReportProcessor";
import { UndoProcessor } from "./processors/UndoProcessor";
import { ExpenseProcessor } from "./processors/ExpenseProcessor";
import { IncomeProcessor } from "./processors/IncomeProcessor";
import { RecurringSetupProcessor } from "./processors/RecurringSetupProcessor";
import { QueryProcessor } from "./processors/QueryProcessor";
import { FallbackProcessor } from "./processors/FallbackProcessor";

export interface ProcessIncomingMessageInput {
  platformUserId: string;
  textMessage: string;
  platformUsername?: string | undefined;
  replyToMessageId?: string | undefined;
  // The message_id of the inline-keyboard message, when this is a button press —
  // lets processors edit that message in place (e.g. multi-select toggles).
  callbackMessageId?: string | undefined;
}

export interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
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
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly queryAgent: IFinancialQueryAgent,
  ) {
    this.preParseProcessors = [
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
      ),
      new OnboardingProcessor(
        userRepository,
        budgetConfigRepository,
        categoryRepository,
        messageService,
      ),
      new SettingsProcessor(userRepository, messageService),
      new HelpProcessor(messageService),
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
      new UndoProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        incomeRepository,
        messageService,
      ),
    ];
    this.postParseProcessors = [
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
      new ExpenseProcessor(
        expenseRepository,
        categoryRepository,
        budgetConfigRepository,
        parseLogRepository,
        incomeRepository,
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
      new QueryProcessor(queryAgent, messageService),
      new FallbackProcessor(messageService),
    ];
  }

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const linkToken = payload.textMessage?.match(/^\/?\s*start\s+(\S+)/i)?.[1];
    const { user, wasLinked } = await this.ensureUserExists(
      payload.platformUserId,
      payload.platformUsername,
      linkToken,
    );

    if (wasLinked) {
      return {
        response: "✅ Account linked!",
        parsed: { intent: "UNKNOWN", confidence: 1 },
      };
    }

    const historyRows = await this.conversationRepository.getRecent(user.id, 6);
    const history: ConversationTurn[] = historyRows.map((h) => ({
      role: h.role === "model" ? "model" : "user",
      content: h.content,
    }));

    const context: ProcessContext = {
      user,
      platformUserId: payload.platformUserId,
      textMessage: payload.textMessage,
      replyToMessageId: payload.replyToMessageId,
      callbackMessageId: payload.callbackMessageId,
      conversationHistory: history,
    };

    // Pre-AI processors (button callbacks, onboarding).
    for (const processor of this.preParseProcessors) {
      if (processor.canHandle(context)) {
        return processor.process(context);
      }
    }

    // AI parse with the user's category list as context.
    const categories = await this.loadCategoryHints(user.id);
    const parsed = await this.aiParser.parseText(payload.textMessage, {
      categories,
      history,
    });
    context.parsed = parsed;

    for (const processor of this.postParseProcessors) {
      if (processor.canHandle(context)) {
        const output = await processor.process(context);
        // Save conversation turns (fire-and-forget — don't block the reply).
        this.conversationRepository
          .append(user.id, "user", payload.textMessage)
          .catch(console.error);
        this.conversationRepository
          .append(user.id, "model", output.response)
          .catch(console.error);
        return output;
      }
    }

    // FallbackProcessor.canHandle always returns true, so this is unreachable.
    throw new Error(`No processor handled intent: ${parsed.intent}`);
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
    name?: string,
    linkToken?: string,
  ): Promise<{ user: User; wasLinked: boolean }> {
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

    const user = await this.userRepository.create({
      telegramId,
      ...(name !== undefined && { name }),
    });
    return { user, wasLinked: false };
  }
}
