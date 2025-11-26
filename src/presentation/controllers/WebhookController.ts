import { Request, Response, NextFunction } from 'express';

import { ProcessIncomingMessageUseCase } from '../../application/use-cases/ProcessIncomingMessage';
import { GeminiParser } from '../../data/ai/GeminiParser';
import { PrismaContactRepository } from '../../data/repositories/PrismaContactRepository';
import { PrismaTransactionRepository } from '../../data/repositories/PrismaTransactionRepository';
import { WhatsAppMessageService } from '../../data/messaging/WhatsAppMessageService';
import { env } from '../../config/env';

import { prisma } from '../../data/prisma/client';

import { PrismaUserRepository } from '../../data/repositories/PrismaUserRepository';

import { PrismaProcessedMessageRepository } from '../../data/repositories/PrismaProcessedMessageRepository';

const aiParser = new GeminiParser();
const userRepository = new PrismaUserRepository(prisma);
const customerRepository = new PrismaContactRepository(prisma);
const transactionRepository = new PrismaTransactionRepository(prisma);
const processedMessageRepository = new PrismaProcessedMessageRepository(prisma);
const messageService = new WhatsAppMessageService();

const processIncomingMessageUseCase = new ProcessIncomingMessageUseCase(
  aiParser,
  userRepository,
  customerRepository,
  transactionRepository,
  messageService,
);

interface MetaMessageEntry {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          id?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
}

export class WebhookController {
  constructor(
    private readonly processIncomingMessage: ProcessIncomingMessageUseCase,
    private readonly processedMessageRepository: PrismaProcessedMessageRepository,
    private readonly verifyToken: string,
  ) { }

  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (token === this.verifyToken && typeof challenge === 'string') {
        res.status(200).send(challenge);
        return;
      }

      res.status(403).json({
        success: false,
        message: 'Verification failed',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Webhook received:', JSON.stringify(req.body, null, 2));
      const payload = req.body as MetaMessageEntry;
      const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!message || message.type !== 'text') {
        console.log('No actionable message found');
        res.status(200).json({
          success: true,
          message: 'No actionable message',
          data: null,
        });
        return;
      }

      const messageId = message.id;
      if (messageId) {
        const isProcessed = await this.processedMessageRepository.exists(messageId);
        if (isProcessed) {
          console.log(`Message ${messageId} already processed. Skipping.`);
          res.status(200).json({
            success: true,
            message: 'Message already processed',
            data: null,
          });
          return;
        }
        await this.processedMessageRepository.create(messageId);
      }

      const senderPhone = message.from ?? '';
      const textMessage = message.text?.body ?? '';
      console.log(`Processing message from ${senderPhone}: ${textMessage}`);

      if (!senderPhone || !textMessage) {
        console.error('Invalid message payload: Missing senderPhone or textMessage');
        res.status(400).json({
          success: false,
          message: 'Invalid message payload',
          data: null,
        });
        return;
      }

      const result = await this.processIncomingMessage.execute({
        senderPhone,
        textMessage,
      });

      console.log('Processed message result:', result);

      res.status(200).json({
        success: true,
        message: 'Message processed',
        data: { response: result.response, intent: result.parsed.intent },
      });
    } catch (error) {
      console.error('Error handling webhook:', error);
      next(error);
    }
  }
}

export const webhookController = new WebhookController(
  processIncomingMessageUseCase,
  processedMessageRepository,
  env.META_VERIFY_TOKEN,
);


