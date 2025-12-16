import { Request, Response, NextFunction } from "express";

import { ProcessIncomingMessageUseCase } from "../../application/use-cases/ProcessIncomingMessage";
import { ProcessVoiceMessageUseCase } from "../../application/use-cases/ProcessVoiceMessage";
import { GeminiParser } from "../../data/ai/GeminiParser";
import { OpenAIParser } from "../../data/ai/OpenAIParser";
import { FallbackAiParser } from "../../data/ai/FallbackAiParser";
import { SarvamTranscriptionService } from "../../data/ai/SarvamTranscriptionService";
import { PrismaContactRepository } from "../../data/repositories/PrismaContactRepository";
import { PrismaTransactionRepository } from "../../data/repositories/PrismaTransactionRepository";
import { WhatsAppMessageService } from "../../data/messaging/WhatsAppMessageService";
import { WhatsAppMediaService } from "../../data/messaging/WhatsAppMediaService";
import { env } from "../../config/env";

import { prisma } from "../../data/prisma/client";

import { PrismaUserRepository } from "../../data/repositories/PrismaUserRepository";

import { PrismaProcessedMessageRepository } from "../../data/repositories/PrismaProcessedMessageRepository";

const geminiParser = new GeminiParser();
const openAIParser = new OpenAIParser();
const aiParser = new FallbackAiParser(openAIParser, geminiParser);

const userRepository = new PrismaUserRepository(prisma);
const customerRepository = new PrismaContactRepository(prisma);
const transactionRepository = new PrismaTransactionRepository(prisma);
const processedMessageRepository = new PrismaProcessedMessageRepository(prisma);
const messageService = new WhatsAppMessageService();
const mediaService = new WhatsAppMediaService();
const transcriptionService = new SarvamTranscriptionService();

const processIncomingMessageUseCase = new ProcessIncomingMessageUseCase(
  aiParser,
  userRepository,
  customerRepository,
  transactionRepository,
  messageService,
);

const processVoiceMessageUseCase = new ProcessVoiceMessageUseCase(
  mediaService,
  transcriptionService,
  processIncomingMessageUseCase,
);

interface MetaMessageEntry {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          text?: { body?: string };
          audio?: { id?: string; mime_type?: string };
          type?: string;
          interactive?: {
            type?: string;
            button_reply?: {
              id?: string;
              title?: string;
            };
          };
          context?: {
            from?: string;
            id?: string;
          };
        }>;
      };
    }>;
  }>;
}

export class WebhookController {
  constructor(
    private readonly processIncomingMessage: ProcessIncomingMessageUseCase,
    private readonly processVoiceMessage: ProcessVoiceMessageUseCase,
    private readonly processedMessageRepository: PrismaProcessedMessageRepository,
    private readonly verifyToken: string,
  ) {}

  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (token === this.verifyToken && typeof challenge === "string") {
        res.status(200).send(challenge);
        return;
      }

      res.status(403).json({
        success: false,
        message: "Verification failed",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("Webhook received:", JSON.stringify(req.body, null, 2));
      const payload = req.body as MetaMessageEntry;
      const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) {
        console.log("No message found in payload");
        res.status(200).json({
          success: true,
          message: "No actionable message",
          data: null,
        });
        return;
      }

      const messageType = message.type;

      // Check if message type is supported (text, audio, or interactive)
      if (
        messageType !== "text" &&
        messageType !== "audio" &&
        messageType !== "interactive"
      ) {
        console.log(`Unsupported message type: ${messageType}`);
        res.status(200).json({
          success: true,
          message: "Unsupported message type",
          data: null,
        });
        return;
      }

      // Check for duplicate messages
      const messageId = message.id;
      if (messageId) {
        const isProcessed =
          await this.processedMessageRepository.exists(messageId);
        if (isProcessed) {
          console.log(`Message ${messageId} already processed. Skipping.`);
          res.status(200).json({
            success: true,
            message: "Message already processed",
            data: null,
          });
          return;
        }
        await this.processedMessageRepository.create(messageId);
      }

      const senderPhone = message.from ?? "";

      if (!senderPhone) {
        console.error("Invalid message payload: Missing senderPhone");
        res.status(400).json({
          success: false,
          message: "Invalid message payload: Missing senderPhone",
          data: null,
        });
        return;
      }

      // Mark message as read and show typing indicator
      if (messageId) {
        await messageService.sendTypingIndicator(messageId);
      }

      // Handle text messages
      if (messageType === "text") {
        const textMessage = message.text?.body ?? "";
        console.log(
          `Processing text message from ${senderPhone}: ${textMessage}`,
        );

        if (!textMessage) {
          console.error("Invalid message payload: Missing text body");
          res.status(400).json({
            success: false,
            message: "Invalid message payload: Missing text body",
            data: null,
          });
          return;
        }

        const replyToMessageId = message.context?.id;

        const input: any = {
          senderPhone,
          textMessage,
        };
        if (replyToMessageId) {
          input.replyToMessageId = replyToMessageId;
        }

        const result = await this.processIncomingMessage.execute(input);

        console.log("Processed text message result:", result);

        res.status(200).json({
          success: true,
          message: "Message processed",
          data: { response: result.response, intent: result.parsed.intent },
        });
        return;
      }

      // Handle audio messages
      if (messageType === "audio") {
        const mediaId = message.audio?.id;
        console.log(
          `Processing voice message from ${senderPhone}, media ID: ${mediaId}`,
        );

        if (!mediaId) {
          console.error("Invalid message payload: Missing audio media ID");
          res.status(400).json({
            success: false,
            message: "Invalid message payload: Missing audio media ID",
            data: null,
          });
          return;
        }

        const result = await this.processVoiceMessage.execute({
          senderPhone,
          mediaId,
          replyToMessageId: message.context?.id,
        });

        console.log("Processed voice message result:", result);

        res.status(200).json({
          success: true,
          message: "Voice message processed",
          data: {
            transcribedText: result.transcribedText,
            response: result.response,
          },
        });
        return;
      }

      // Handle interactive messages (Button replies)
      if (messageType === "interactive") {
        const buttonReply = message.interactive?.button_reply;
        const buttonId = buttonReply?.id;
        const buttonTitle = buttonReply?.title;

        console.log(
          `Processing interactive message from ${senderPhone}: ID=${buttonId}, Title=${buttonTitle}`,
        );

        if (!buttonId) {
          console.error("Invalid message payload: Missing button ID");
          res.status(400).json({
            success: false,
            message: "Invalid message payload: Missing button ID",
            data: null,
          });
          return;
        }

        // We pass the button ID as the text message so ConfirmationProcessor can handle it
        const result = await this.processIncomingMessage.execute({
          senderPhone,
          textMessage: buttonId,
          replyToMessageId: message.context?.id,
        });

        console.log("Processed interactive message result:", result);

        res.status(200).json({
          success: true,
          message: "Interactive message processed",
          data: { response: result.response, intent: result.parsed.intent },
        });
        return;
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      next(error);
    }
  }
}

export const webhookController = new WebhookController(
  processIncomingMessageUseCase,
  processVoiceMessageUseCase,
  processedMessageRepository,
  env.META_VERIFY_TOKEN,
);
