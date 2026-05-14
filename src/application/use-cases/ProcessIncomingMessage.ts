import { IAiParser } from "../../domain/services/IAiParser";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IContactRepository } from "../../domain/repositories/IContactRepository";
import { ITransactionRepository } from "../../domain/repositories/ITransactionRepository";
import { IWalletRepository } from "../../domain/repositories/IWalletRepository";
import { IRecurringChargeRepository } from "../../domain/repositories/IRecurringChargeRepository";
import { IDueEntryRepository } from "../../domain/repositories/IDueEntryRepository";
import { IGroupRepository } from "../../domain/repositories/IGroupRepository";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { ParsedData } from "../../domain/entities/ParsedData";
import { User, Transaction } from "@prisma/client";
import { MessageProcessor } from "./processors/MessageProcessor";
import { StartProcessor } from "./processors/StartProcessor";
import { BalanceProcessor } from "./processors/BalanceProcessor";
import { TransactionProcessor } from "./processors/TransactionProcessor";
import { UndoProcessor } from "./processors/UndoProcessor";
import { ReplyProcessor } from "./processors/ReplyProcessor";
import { ConfirmationProcessor } from "./processors/ConfirmationProcessor";
import { DailySummaryProcessor } from "./processors/DailySummaryProcessor";
import { ChatProcessor } from "./processors/ChatProcessor";
import { QueryProcessor, IQueryAgent } from "./processors/QueryProcessor";
import { WalletProcessor } from "./processors/WalletProcessor";
import { RecurringSetupProcessor } from "./processors/RecurringSetupProcessor";
import { DuePaymentProcessor } from "./processors/DuePaymentProcessor";
import { GroupOnboardingProcessor } from "./processors/GroupOnboardingProcessor";
import { GroupQueryProcessor } from "./processors/GroupQueryProcessor";

export interface ProcessIncomingMessageInput {
  platformUserId: string;
  textMessage: string;
  platformUsername?: string | undefined;
  replyToMessageId?: string | undefined;
}

export interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
}

const QUICK_REPLIES: Record<string, string> = {
  ping: "pong",
  admin: "Sadik is here 💦",
};

// "Shop: paid 500 supplies" → walletName = "Shop", strippedText = "paid 500 supplies"
const WALLET_PREFIX_RE = /^([a-zA-Z][a-zA-Z0-9 ]{0,19}):\s*/;

export class ProcessIncomingMessageUseCase {
  private processors: MessageProcessor[];

  constructor(
    private readonly aiParser: IAiParser,
    private readonly userRepository: IUserRepository,
    private readonly contactRepository: IContactRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly walletRepository: IWalletRepository,
    private readonly recurringChargeRepository: IRecurringChargeRepository,
    private readonly dueEntryRepository: IDueEntryRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly conversationRepository: IConversationRepository,
    queryAgent?: IQueryAgent,
  ) {
    this.processors = [
      new DuePaymentProcessor(dueEntryRepository, messageService),
      new GroupOnboardingProcessor(groupRepository, messageService),
      new ConfirmationProcessor(transactionRepository, messageService),
      new StartProcessor(messageService),
      new ReplyProcessor(transactionRepository, messageService),
      new UndoProcessor(transactionRepository, messageService),
      new ChatProcessor(messageService),
      new WalletProcessor(walletRepository, messageService),
      new RecurringSetupProcessor(
        recurringChargeRepository,
        dueEntryRepository,
        walletRepository,
        messageService,
      ),
      new GroupQueryProcessor(
        transactionRepository,
        groupRepository,
        messageService,
      ),
      new QueryProcessor(queryAgent ?? null, messageService),
      new BalanceProcessor(
        transactionRepository,
        contactRepository,
        messageService,
      ),
      new TransactionProcessor(
        transactionRepository,
        contactRepository,
        messageService,
      ),
      new DailySummaryProcessor(transactionRepository, messageService),
    ];
  }

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const normalizedMessage = payload.textMessage.trim().toLowerCase();
    console.log(
      `Executing ProcessIncomingMessage for ${payload.platformUserId} with message: "${normalizedMessage}"`,
    );

    const linkToken = payload.textMessage?.match(/^\/?\s*start\s+(\S+)/i)?.[1];
    const { user, wasLinked } = await this.ensureUserExists(
      payload.platformUserId,
      payload.platformUsername,
      linkToken,
    );
    console.log(`User identified: ${user.id}`);

    // Linking message already handled — confirmation sent, nothing else to do
    if (wasLinked) {
      return {
        response: "✅ Account linked!",
        parsed: {
          intent: "START",
          notes: "Telegram account linked via web token",
        },
      };
    }

    const [groupContextRaw, conversationHistory] = await Promise.all([
      this.groupRepository.findGroupContextForUser(user.id),
      this.conversationRepository.getRecent(user.id, 6),
    ]);
    const groupContext = groupContextRaw ?? undefined;

    let replyTransaction: Transaction | null = null;
    if (payload.replyToMessageId) {
      replyTransaction = await this.transactionRepository.findByConfirmationId(
        payload.replyToMessageId,
      );
    }

    const quickReply = QUICK_REPLIES[normalizedMessage];
    if (quickReply) {
      await this.messageService.sendMessage({
        to: payload.platformUserId,
        body: quickReply,
      });
      return {
        response: quickReply,
        parsed: {
          intent: "QUICK_REPLY",
          notes: `Quick reply for keyword: ${normalizedMessage}`,
        },
      };
    }

    // Extract optional wallet prefix: "Shop: paid 500 supplies"
    let walletId: string | undefined;
    let walletName: string | undefined;
    let textMessage = payload.textMessage;

    const walletMatch = payload.textMessage.match(WALLET_PREFIX_RE);
    if (walletMatch && walletMatch[1]) {
      const candidate = walletMatch[1].trim();
      const wallet = await this.walletRepository.findByName(user.id, candidate);
      if (wallet) {
        walletId = wallet.id;
        walletName = wallet.name;
        textMessage = payload.textMessage.slice(walletMatch[0].length);
      }
    }

    const history = conversationHistory.map((h) => ({
      role: h.role as "user" | "model",
      content: h.content,
    }));

    const contextWithoutParse = {
      user,
      platformUserId: payload.platformUserId,
      textMessage,
      replyToMessageId: payload.replyToMessageId,
      replyTransaction: replyTransaction ?? undefined,
      walletId,
      walletName,
      groupContext,
      conversationHistory: history,
    };

    for (const processor of this.processors) {
      if (
        processor instanceof DuePaymentProcessor ||
        processor instanceof GroupOnboardingProcessor ||
        processor instanceof StartProcessor ||
        processor instanceof ConfirmationProcessor
      ) {
        if (processor.canHandle(contextWithoutParse)) {
          return processor.process(contextWithoutParse);
        }
      }
      if (
        processor instanceof ReplyProcessor &&
        processor.canHandle(contextWithoutParse)
      ) {
        return processor.process(contextWithoutParse);
      }
    }

    console.log("Parsing message with AI...");
    const parsed = await this.aiParser.parseText(
      textMessage,
      replyTransaction,
      history,
    );
    console.log("AI Parsed result:", JSON.stringify(parsed, null, 2));

    const contextWithParse = {
      ...contextWithoutParse,
      parsed,
    };

    for (const processor of this.processors) {
      if (processor.canHandle(contextWithParse)) {
        const output = await processor.process(contextWithParse);
        // Save conversation turns (fire-and-forget — don't block reply)
        this.conversationRepository
          .append(user.id, "user", textMessage)
          .catch(console.error);
        this.conversationRepository
          .append(user.id, "model", output.response)
          .catch(console.error);
        return output;
      }
    }

    throw new Error(`Unsupported intent: ${parsed.intent}`);
  }

  private async ensureUserExists(
    telegramId: string,
    name?: string,
    linkToken?: string,
  ): Promise<{ user: User; wasLinked: boolean }> {
    const existing = await this.userRepository.findByTelegramId(telegramId);
    if (existing) return { user: existing, wasLinked: false };

    if (linkToken) {
      const linked = await this.userRepository.linkTelegramByToken(
        linkToken,
        telegramId,
      );
      if (linked) {
        await this.messageService.sendMessage({
          to: telegramId,
          body: `✅ Account linked! Your Telegram is now connected to Blipko. Try saying "Gave 500 to Raju" to track a payment.`,
        });
        return { user: linked, wasLinked: true };
      }
    }

    console.log(`Creating new user for Telegram ID ${telegramId}`);
    const user = await this.userRepository.create({
      telegramId,
      ...(name !== undefined && { name }),
    });

    // Auto-create a default Personal wallet for new users
    await this.walletRepository.create({
      name: "Personal",
      emoji: "👤",
      type: "PERSONAL",
      isDefault: true,
      userId: user.id,
    });

    return { user, wasLinked: false };
  }
}
