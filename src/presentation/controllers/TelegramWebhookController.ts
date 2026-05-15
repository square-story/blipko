import { Request, Response, NextFunction } from "express";
import { ProcessIncomingMessageUseCase } from "../../application/use-cases/ProcessIncomingMessage";
import { ProcessVoiceMessageUseCase } from "../../application/use-cases/ProcessVoiceMessage";
import { PrismaProcessedMessageRepository } from "../../data/repositories/PrismaProcessedMessageRepository";
import { TelegramMessageService } from "../../data/messaging/TelegramMessageService";
import { TelegramMediaService } from "../../data/messaging/TelegramMediaService";
import { GeminiParser } from "../../data/ai/GeminiParser";
import { GeminiQueryAgent } from "../../data/ai/GeminiQueryAgent";
import { OpenAIParser } from "../../data/ai/OpenAIParser";
import { FallbackAiParser } from "../../data/ai/FallbackAiParser";
import { SarvamTranscriptionService } from "../../data/ai/SarvamTranscriptionService";
import { PrismaContactRepository } from "../../data/repositories/PrismaContactRepository";
import { PrismaTransactionRepository } from "../../data/repositories/PrismaTransactionRepository";
import { PrismaUserRepository } from "../../data/repositories/PrismaUserRepository";
import { PrismaWalletRepository } from "../../data/repositories/PrismaWalletRepository";
import { PrismaRecurringChargeRepository } from "../../data/repositories/PrismaRecurringChargeRepository";
import { PrismaDueEntryRepository } from "../../data/repositories/PrismaDueEntryRepository";
import { PrismaGroupRepository } from "../../data/repositories/PrismaGroupRepository";
import { PrismaConversationRepository } from "../../data/repositories/PrismaConversationRepository";
import { prisma } from "../../data/prisma/client";
import { env } from "../../config/env";

// ── Telegram Update shape ────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number };
    text?: string;
    voice?: { file_id: string; mime_type?: string };
    audio?: { file_id: string; mime_type?: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

// ── Dependency wiring ────────────────────────────────────────────────────────

const messageService = new TelegramMessageService();
const mediaService = new TelegramMediaService();
const transcriptionService = new SarvamTranscriptionService();

const aiParser = new FallbackAiParser(new OpenAIParser(), new GeminiParser());

const userRepository = new PrismaUserRepository(prisma);
const contactRepository = new PrismaContactRepository(prisma);
const transactionRepository = new PrismaTransactionRepository(prisma);
const queryAgent = new GeminiQueryAgent(
  transactionRepository,
  contactRepository,
);
const processedMessageRepository = new PrismaProcessedMessageRepository(prisma);
const walletRepository = new PrismaWalletRepository(prisma);
const recurringChargeRepository = new PrismaRecurringChargeRepository(prisma);
const dueEntryRepository = new PrismaDueEntryRepository(prisma);
const groupRepository = new PrismaGroupRepository(prisma);
const conversationRepository = new PrismaConversationRepository();

const processIncomingMessage = new ProcessIncomingMessageUseCase(
  aiParser,
  userRepository,
  contactRepository,
  transactionRepository,
  messageService,
  walletRepository,
  recurringChargeRepository,
  dueEntryRepository,
  groupRepository,
  conversationRepository,
  queryAgent,
);

const processVoiceMessage = new ProcessVoiceMessageUseCase(
  mediaService,
  transcriptionService,
  processIncomingMessage,
);

// ── Controller ───────────────────────────────────────────────────────────────

export class TelegramWebhookController {
  constructor(
    private readonly processIncomingMessage: ProcessIncomingMessageUseCase,
    private readonly processVoiceMessage: ProcessVoiceMessageUseCase,
    private readonly processedMessageRepository: PrismaProcessedMessageRepository,
    private readonly messageService: TelegramMessageService,
    private readonly webhookSecret?: string,
  ) {}

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      // Verify webhook secret if configured
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (this.webhookSecret && secret !== this.webhookSecret) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
      }

      const update = req.body as TelegramUpdate;

      // ── Callback query (inline button press) ──────────────────────────────
      if (update.callback_query) {
        const cq = update.callback_query;
        const platformUserId = String(cq.from.id);
        const updateId = String(update.update_id);

        const isProcessed =
          await this.processedMessageRepository.exists(updateId);
        if (isProcessed) {
          res.status(200).json({ success: true });
          return;
        }
        await this.processedMessageRepository.create(updateId);

        // Ack the button press immediately so Telegram stops showing the spinner
        await this.messageService.acknowledgeInteraction(cq.id);
        await this.messageService.sendTypingIndicator(platformUserId);

        const result = await this.processIncomingMessage.execute({
          platformUserId,
          platformUsername: cq.from.username ?? cq.from.first_name,
          textMessage: cq.data ?? "",
        });

        res
          .status(200)
          .json({ success: true, data: { response: result.response } });
        return;
      }

      // ── Regular message ───────────────────────────────────────────────────
      const msg = update.message;
      if (!msg) {
        res
          .status(200)
          .json({ success: true, message: "No actionable update" });
        return;
      }

      const platformUserId = String(msg.chat.id);
      const messageId = String(msg.message_id);
      const platformUsername = msg.from?.username ?? msg.from?.first_name;
      const replyToMessageId = msg.reply_to_message
        ? String(msg.reply_to_message.message_id)
        : undefined;

      // Dedup
      const isProcessed =
        await this.processedMessageRepository.exists(messageId);
      if (isProcessed) {
        res.status(200).json({ success: true, message: "Already processed" });
        return;
      }
      await this.processedMessageRepository.create(messageId);

      await this.messageService.sendTypingIndicator(platformUserId);

      // ── Voice / audio ─────────────────────────────────────────────────────
      const audioFileId = msg.voice?.file_id ?? msg.audio?.file_id;
      if (audioFileId) {
        const result = await this.processVoiceMessage.execute({
          platformUserId,
          audioFileId,
          replyToMessageId,
        });
        res.status(200).json({
          success: true,
          data: {
            transcribedText: result.transcribedText,
            response: result.response,
          },
        });
        return;
      }

      // ── Text ──────────────────────────────────────────────────────────────
      const text = msg.text;
      if (!text) {
        res
          .status(200)
          .json({ success: true, message: "Unsupported message type" });
        return;
      }

      const result = await this.processIncomingMessage.execute({
        platformUserId,
        platformUsername,
        textMessage: text,
        replyToMessageId,
      });

      res.status(200).json({
        success: true,
        data: { response: result.response, intent: result.parsed.intent },
      });
    } catch (error) {
      console.error("TelegramWebhookController error:", error);
      next(error);
    }
  }
}

export const telegramWebhookController = new TelegramWebhookController(
  processIncomingMessage,
  processVoiceMessage,
  processedMessageRepository,
  messageService,
  env.TELEGRAM_WEBHOOK_SECRET,
);

import { SendDueNotificationsUseCase } from "../../application/use-cases/SendDueNotifications";
export const sendDueNotifications = new SendDueNotificationsUseCase(
  dueEntryRepository,
  messageService,
);

import { GenerateDueEntriesUseCase } from "../../application/use-cases/GenerateDueEntries";
export const generateDueEntries = new GenerateDueEntriesUseCase(
  recurringChargeRepository,
  dueEntryRepository,
);
