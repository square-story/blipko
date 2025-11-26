import { Request, Response, NextFunction } from 'express';

import { ProcessIncomingMessageUseCase } from '../../application/use-cases/ProcessIncomingMessage';
import { GeminiParser } from '../../data/ai/GeminiParser';
import { PrismaCustomerRepository } from '../../data/repositories/PrismaCustomerRepository';
import { PrismaTransactionRepository } from '../../data/repositories/PrismaTransactionRepository';
import { WhatsAppMessageService } from '../../data/messaging/WhatsAppMessageService';
import { env } from '../../config/env';

const aiParser = new GeminiParser();
const customerRepository = new PrismaCustomerRepository();
const transactionRepository = new PrismaTransactionRepository();
const messageService = new WhatsAppMessageService();

const processIncomingMessageUseCase = new ProcessIncomingMessageUseCase(
  aiParser,
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
      const payload = req.body as MetaMessageEntry;
      const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!message || message.type !== 'text') {
        res.status(200).json({
          success: true,
          message: 'No actionable message',
          data: null,
        });
        return;
      }

      const senderPhone = message.from ?? '';
      const textMessage = message.text?.body ?? '';
      console.log(senderPhone, textMessage)
      if (!senderPhone || !textMessage) {
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
      next(error);
    }
  }
}

export const webhookController = new WebhookController(
  processIncomingMessageUseCase,
  env.META_VERIFY_TOKEN,
);


