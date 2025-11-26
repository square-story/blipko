import { IAiParser } from '../../domain/services/IAiParser';
import {
  ICustomerRepository,
  CreateCustomerDTO,
} from '../../domain/repositories/ICustomerRepository';
import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import { IMessageService } from '../interfaces/IMessageService';
import { ParsedData, ParsedIntent } from '../../domain/entities/ParsedData';

interface ProcessIncomingMessageInput {
  senderPhone: string;
  textMessage: string;
}

interface ProcessIncomingMessageOutput {
  response: string;
  parsed: ParsedData;
}

const QUICK_REPLIES: Record<string, string> = {
  ping: 'pong',
  hello: 'Hi there! 👋',
  admin: "Sadik is here 💦"
};

const isTransactionIntent = (
  intent: ParsedIntent,
): intent is Extract<ParsedIntent, 'CREDIT' | 'DEBIT'> => intent === 'CREDIT' || intent === 'DEBIT';

type TransactionIntent = Extract<ParsedIntent, 'CREDIT' | 'DEBIT'>;
type TransactionParsedData = ParsedData & { intent: TransactionIntent; amount: number };

export class ProcessIncomingMessageUseCase {
  constructor(
    private readonly aiParser: IAiParser,
    private readonly customerRepository: ICustomerRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) { }

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const normalizedMessage = payload.textMessage.trim().toLowerCase();

    if (normalizedMessage === 'start') {
      return this.handleStartIntent(payload.senderPhone);
    }

    const quickReply = QUICK_REPLIES[normalizedMessage];
    if (quickReply) {
      return this.handleQuickReply(payload.senderPhone, normalizedMessage, quickReply);
    }

    const parsed = await this.aiParser.parseText(payload.textMessage);

    if (parsed.intent === 'BALANCE') {
      return this.handleBalanceIntent(payload.senderPhone, parsed);
    }

    if (isTransactionIntent(parsed.intent)) {
      if (typeof parsed.amount !== 'number') {
        throw new Error('Amount is required for CREDIT or DEBIT intents');
      }

      return this.handleTransactionIntent(payload.senderPhone, {
        ...parsed,
        amount: parsed.amount,
        intent: parsed.intent,
      });
    }

    throw new Error(`Unsupported intent: ${parsed.intent}`);
  }

  private async handleStartIntent(
    phoneNumber: string,
  ): Promise<ProcessIncomingMessageOutput> {
    const response =
      "👋 Welcome to AI Ledger! Tell me things like 'Gave 500 to Raju' or ask 'Balance for Raju' to track your ledger.";

    await this.messageService.sendMessage({ to: phoneNumber, body: response });

    return {
      response,
      parsed: { intent: 'START', notes: 'User initiated onboarding' },
    };
  }

  private async handleQuickReply(
    phoneNumber: string,
    keyword: string,
    response: string,
  ): Promise<ProcessIncomingMessageOutput> {
    await this.messageService.sendMessage({ to: phoneNumber, body: response });

    return {
      response,
      parsed: { intent: 'QUICK_REPLY', notes: `Quick reply for keyword: ${keyword}` },
    };
  }

  private async handleBalanceIntent(
    phoneNumber: string,
    parsed: ParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    const customer = await this.ensureCustomerExists({
      phoneNumber,
      name: parsed.name ?? 'Friend',
    });

    const response = `📊 Balance for ${customer.name}: ${customer.currentBalance.toFixed(2)}`;
    await this.messageService.sendMessage({ to: phoneNumber, body: response });

    return { response, parsed };
  }

  private async handleTransactionIntent(
    phoneNumber: string,
    parsed: TransactionParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    const customer = await this.ensureCustomerExists({
      phoneNumber,
      name: parsed.name ?? 'Friend',
    });

    const transaction = await this.transactionRepository.create({
      amount: parsed.amount,
      type: parsed.intent,
      ...(typeof parsed.notes === 'string' ? { description: parsed.notes } : {}),
      customerId: customer.id,
    });

    const updatedBalance =
      parsed.intent === 'CREDIT'
        ? customer.currentBalance + transaction.amount
        : customer.currentBalance - transaction.amount;

    const updatedCustomer = await this.customerRepository.updateBalance(
      customer.id,
      updatedBalance,
    );

    const response = `✅ Recorded ${transaction.amount.toFixed(2)} for ${updatedCustomer.name}. New balance: ${updatedCustomer.currentBalance.toFixed(
      2,
    )}`;

    await this.messageService.sendMessage({ to: phoneNumber, body: response });

    return { response, parsed };
  }

  private async ensureCustomerExists(data: CreateCustomerDTO) {
    const existing = await this.customerRepository.findByPhone(data.phoneNumber);
    if (existing) {
      return existing;
    }

    if (data.name) {
      const byName = await this.customerRepository.findByName(data.name);
      if (byName) {
        return byName;
      }
    }

    return this.customerRepository.create({
      phoneNumber: data.phoneNumber,
      name: data.name,
      initialBalance: data.initialBalance ?? 0,
    });
  }
}


