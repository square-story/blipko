import { IAiParser } from "../../domain/services/IAiParser";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IContactRepository } from "../../domain/repositories/IContactRepository";
import { ITransactionRepository } from "../../domain/repositories/ITransactionRepository";
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
import { QueryProcessor } from "./processors/QueryProcessor";

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

export class ProcessIncomingMessageUseCase {
  private processors: MessageProcessor[];

  constructor(
    private readonly aiParser: IAiParser,
    private readonly userRepository: IUserRepository,
    private readonly contactRepository: IContactRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessagingPlatform,
  ) {
    this.processors = [
      new ConfirmationProcessor(transactionRepository, messageService),
      new StartProcessor(messageService),
      new ReplyProcessor(transactionRepository, messageService),
      new UndoProcessor(transactionRepository, messageService),
      new ChatProcessor(messageService),
      new QueryProcessor(
        transactionRepository,
        contactRepository,
        messageService,
      ),
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

    const user = await this.ensureUserExists(
      payload.platformUserId,
      payload.platformUsername,
    );
    console.log(`User identified: ${user.id}`);

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

    const contextWithoutParse = {
      user,
      platformUserId: payload.platformUserId,
      textMessage: payload.textMessage,
      replyToMessageId: payload.replyToMessageId,
      replyTransaction: replyTransaction ?? undefined,
    };

    for (const processor of this.processors) {
      if (
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
      payload.textMessage,
      replyTransaction,
    );
    console.log("AI Parsed result:", JSON.stringify(parsed, null, 2));

    const contextWithParse = {
      ...contextWithoutParse,
      parsed,
    };

    for (const processor of this.processors) {
      if (processor.canHandle(contextWithParse)) {
        return processor.process(contextWithParse);
      }
    }

    throw new Error(`Unsupported intent: ${parsed.intent}`);
  }

  private async ensureUserExists(
    telegramId: string,
    name?: string,
  ): Promise<User> {
    const existing = await this.userRepository.findByTelegramId(telegramId);
    if (existing) return existing;

    console.log(`Creating new user for Telegram ID ${telegramId}`);
    return this.userRepository.create({
      telegramId,
      ...(name !== undefined && { name }),
    });
  }
}
