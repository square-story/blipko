import { IAiParser } from "../../domain/services/IAiParser";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IContactRepository } from "../../domain/repositories/IContactRepository";
import { ITransactionRepository } from "../../domain/repositories/ITransactionRepository";
import { IMessageService } from "../interfaces/IMessageService";
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

export interface ProcessIncomingMessageInput {
  senderPhone: string;
  textMessage: string;
  senderName?: string | undefined;
  replyToMessageId?: string | undefined;
}

export interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
}

const QUICK_REPLIES: Record<string, string> = {
  ping: "pong",
  hello: "Hi there! 👋",
  admin: "Sadik is here 💦",
};

export class ProcessIncomingMessageUseCase {
  private processors: MessageProcessor[];

  constructor(
    private readonly aiParser: IAiParser,
    private readonly userRepository: IUserRepository,
    private readonly contactRepository: IContactRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) {
    this.processors = [
      new ConfirmationProcessor(transactionRepository, messageService),
      new StartProcessor(messageService),
      new ReplyProcessor(transactionRepository, messageService),
      new UndoProcessor(transactionRepository, messageService),
      new BalanceProcessor(
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
      `Executing ProcessIncomingMessage for ${payload.senderPhone} with message: "${normalizedMessage}"`,
    );

    // 1. Identify or Create User
    const user = await this.ensureUserExists(
      payload.senderPhone,
      payload.senderName,
    );
    console.log(`User identified: ${user.id}`);

    // 2. Prepare Context
    let replyTransaction: Transaction | null = null;
    if (payload.replyToMessageId) {
      replyTransaction = await this.transactionRepository.findByConfirmationId(
        payload.replyToMessageId,
      );
    }

    // Quick check for quick replies before AI parsing
    const quickReply = QUICK_REPLIES[normalizedMessage];
    if (quickReply) {
      await this.messageService.sendMessage({
        to: user.phoneNumber!,
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

    // Only parse if not a simple command handled by processors without parsing (like Start or Confirmation)
    // However, our processors might need parsed data.
    // Optimization: Check if any processor can handle WITHOUT parsing first.
    // StartProcessor and ConfirmationProcessor don't need AI parsing.

    const contextWithoutParse = {
      user,
      textMessage: payload.textMessage, // Use original case for some checks if needed, but processors handle it
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
      // ReplyProcessor might need parsing if it's complex, but for now it checks text.
      if (
        processor instanceof ReplyProcessor &&
        processor.canHandle(contextWithoutParse)
      ) {
        return processor.process(contextWithoutParse);
      }
    }

    // If no "simple" processor handled it, run AI Parser
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
    phoneNumber: string,
    name?: string,
  ): Promise<User> {
    const existing = await this.userRepository.findByPhone(phoneNumber);
    if (existing) {
      return existing;
    }
    console.log(`Creating new user for phone ${phoneNumber} with name ${name}`);

    const userData: any = {
      phoneNumber: phoneNumber,
    };
    if (name) {
      userData.name = name;
    }

    return this.userRepository.create(userData);
  }
}
