import { IAiParser } from '../../domain/services/IAiParser';
import { IUserRepository, CreateUserDTO } from '../../domain/repositories/IUserRepository';
import { IContactRepository } from '../../domain/repositories/IContactRepository';
import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository';
import { IMessageService } from '../interfaces/IMessageService';
import { ParsedData, ParsedIntent } from '../../domain/entities/ParsedData';
import { User, Contact } from '@prisma/client';

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
    private readonly userRepository: IUserRepository,
    private readonly contactRepository: IContactRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly messageService: IMessageService,
  ) { }

  async execute(
    payload: ProcessIncomingMessageInput,
  ): Promise<ProcessIncomingMessageOutput> {
    const normalizedMessage = payload.textMessage.trim().toLowerCase();
    console.log(`Executing ProcessIncomingMessage for ${payload.senderPhone} with message: "${normalizedMessage}"`);

    // 1. Identify or Create User
    const user = await this.ensureUserExists(payload.senderPhone);
    console.log(`User identified: ${user.id}`);


    if (normalizedMessage === 'start') {
      return this.handleStartIntent(user);
    }

    const quickReply = QUICK_REPLIES[normalizedMessage];
    if (quickReply) {
      return this.handleQuickReply(user, normalizedMessage, quickReply);
    }

    console.log('Parsing message with AI...');
    const parsed = await this.aiParser.parseText(payload.textMessage);
    console.log('AI Parsed result:', JSON.stringify(parsed, null, 2));

    if (parsed.intent === 'BALANCE') {
      return this.handleBalanceIntent(user, parsed);
    }

    if (isTransactionIntent(parsed.intent)) {
      if (typeof parsed.amount !== 'number') {
        throw new Error('Amount is required for CREDIT or DEBIT intents');
      }

      return this.handleTransactionIntent(user, {
        ...parsed,
        amount: parsed.amount,
        intent: parsed.intent,
      });
    }

    throw new Error(`Unsupported intent: ${parsed.intent}`);
  }

  private async handleStartIntent(
    user: User,
  ): Promise<ProcessIncomingMessageOutput> {
    const response =
      "👋 Welcome to Blipko! Tell me things like 'Gave 500 to Raju' or ask 'Balance for Raju' to track your ledger.";

    await this.messageService.sendMessage({ to: user.phoneNumber, body: response });

    return {
      response,
      parsed: { intent: 'START', notes: 'User initiated onboarding' },
    };
  }

  private async handleQuickReply(
    user: User,
    keyword: string,
    response: string,
  ): Promise<ProcessIncomingMessageOutput> {
    await this.messageService.sendMessage({ to: user.phoneNumber, body: response });

    return {
      response,
      parsed: { intent: 'QUICK_REPLY', notes: `Quick reply for keyword: ${keyword}` },
    };
  }

  private async handleBalanceIntent(
    user: User,
    parsed: ParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    if (!parsed.name) {
      const response = "Please specify a contact name to check balance (e.g., 'Balance for Raju')";
      await this.messageService.sendMessage({ to: user.phoneNumber, body: response });
      return { response, parsed };
    }

    const contact = await this.contactRepository.findByName(user.id, parsed.name);

    if (!contact) {
      const response = `You don't have any records with ${parsed.name} yet.`;
      await this.messageService.sendMessage({ to: user.phoneNumber, body: response });
      return { response, parsed };
    }

    const contactTransactions = await this.transactionRepository.findByContact(contact.id);

    let balance = 0;
    for (const t of contactTransactions) {
      if (t.intent === 'CREDIT') { // I gave money
        balance += Number(t.amount);
      } else if (t.intent === 'DEBIT') { // I received money
        balance -= Number(t.amount);
      }
    }

    const response = `📊 Balance with ${contact.name}: ${balance.toFixed(2)} (${balance >= 0 ? 'You are owed' : 'You owe'})`;
    await this.messageService.sendMessage({ to: user.phoneNumber, body: response });

    return { response, parsed };
  }

  private async handleTransactionIntent(
    user: User,
    parsed: TransactionParsedData,
  ): Promise<ProcessIncomingMessageOutput> {
    let contact: Contact | null = null;

    if (parsed.name) {
      contact = await this.ensureContactExists(user.id, parsed.name);
    }

    console.log(`Creating transaction for user ${user.id}, contact ${contact?.id}, amount ${parsed.amount}, intent ${parsed.intent}`);
    const transaction = await this.transactionRepository.create({
      amount: parsed.amount,
      intent: parsed.intent,
      description: parsed.category,
      userId: user.id,
      category: parsed.category,
      contactId: contact?.id,
    });

    const response = `✅ Recorded ${parsed.intent} of ${transaction.amount.toFixed(2)} ${contact ? `with ${contact.name}` : ''}.`;

    await this.messageService.sendMessage({ to: user.phoneNumber, body: response });

    return { response, parsed };
  }

  private async ensureUserExists(phoneNumber: string): Promise<User> {
    const existing = await this.userRepository.findByPhone(phoneNumber);
    if (existing) {
      console.log(`Found existing user for phone ${phoneNumber}`);
      return existing;
    }
    console.log(`Creating new user for phone ${phoneNumber}`);

    return this.userRepository.create({
      phoneNumber: phoneNumber,
    });
  }

  private async ensureContactExists(userId: string, name: string): Promise<Contact> {
    const existing = await this.contactRepository.findByName(userId, name);
    if (existing) {
      console.log(`Found existing contact ${name} for user ${userId}`);
      return existing;
    }
    console.log(`Creating new contact ${name} for user ${userId}`);

    return this.contactRepository.create({
      userId,
      name
    });
  }
}


