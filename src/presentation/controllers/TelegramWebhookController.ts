import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { ProcessIncomingMessageUseCase } from "../../application/use-cases/ProcessIncomingMessage";
import { ProcessVoiceMessageUseCase } from "../../application/use-cases/ProcessVoiceMessage";
import { PrismaProcessedMessageRepository } from "../../data/repositories/PrismaProcessedMessageRepository";
import { TelegramMessageService } from "../../data/messaging/TelegramMessageService";
import { TelegramMediaService } from "../../data/messaging/TelegramMediaService";
import { GeminiParser } from "../../data/ai/GeminiParser";
import { OpenAIParser } from "../../data/ai/OpenAIParser";
import { FallbackAiParser } from "../../data/ai/FallbackAiParser";
import { SarvamTranscriptionService } from "../../data/ai/SarvamTranscriptionService";
import { PrismaUserRepository } from "../../data/repositories/PrismaUserRepository";
import { PrismaExpenseRepository } from "../../data/repositories/PrismaExpenseRepository";
import { PrismaCategoryRepository } from "../../data/repositories/PrismaCategoryRepository";
import { PrismaBudgetConfigRepository } from "../../data/repositories/PrismaBudgetConfigRepository";
import { PrismaParseLogRepository } from "../../data/repositories/PrismaParseLogRepository";
import { PrismaConversationRepository } from "../../data/repositories/PrismaConversationRepository";
import { PrismaNudgeRepository } from "../../data/repositories/PrismaNudgeRepository";
import { SendBudgetNudgesUseCase } from "../../application/use-cases/SendBudgetNudges";
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
const expenseRepository = new PrismaExpenseRepository(prisma);
const categoryRepository = new PrismaCategoryRepository(prisma);
const budgetConfigRepository = new PrismaBudgetConfigRepository(prisma);
const parseLogRepository = new PrismaParseLogRepository(prisma);
const nudgeRepository = new PrismaNudgeRepository(prisma);
const processedMessageRepository = new PrismaProcessedMessageRepository(prisma);
const conversationRepository = new PrismaConversationRepository();

const processIncomingMessage = new ProcessIncomingMessageUseCase(
  aiParser,
  userRepository,
  expenseRepository,
  categoryRepository,
  budgetConfigRepository,
  parseLogRepository,
  conversationRepository,
  messageService,
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
    private readonly botToken?: string,
  ) {}

  async registerBotCommands(): Promise<void> {
    if (!this.botToken) return;
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start",  description: "Set up your budget" },
            { command: "status", description: "Your budget health this month" },
            { command: "report", description: "This month's summary" },
            { command: "help",   description: "How to use the bot" },
          ],
        }),
      });
      console.log("Telegram bot commands registered");
    } catch (err) {
      console.error("Failed to register bot commands:", err);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      // Verify webhook secret if configured (timing-safe comparison)
      if (this.webhookSecret) {
        const incoming = req.headers["x-telegram-bot-api-secret-token"];
        if (typeof incoming !== "string") {
          res.status(403).json({ success: false, message: "Forbidden", data: null });
          return;
        }
        const a = Buffer.from(incoming);
        const b = Buffer.from(this.webhookSecret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          res.status(403).json({ success: false, message: "Forbidden", data: null });
          return;
        }
      }

      const update = req.body as TelegramUpdate;

      // ── Callback query (inline button press) ──────────────────────────────
      if (update.callback_query) {
        const cq = update.callback_query;
        const platformUserId = String(cq.from.id);
        const updateId = "cb:" + String(update.update_id);

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
      const messageId = "msg:" + String(msg.message_id);
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
  env.TELEGRAM_BOT_TOKEN,
);

export const sendBudgetNudges = new SendBudgetNudgesUseCase(
  userRepository,
  expenseRepository,
  budgetConfigRepository,
  nudgeRepository,
  messageService,
);
