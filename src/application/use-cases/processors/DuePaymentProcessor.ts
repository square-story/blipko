import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IDueEntryRepository } from "../../../domain/repositories/IDueEntryRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

const MARK_PAID_PREFIX = "mark_paid_";
const SNOOZE_PREFIX = "snooze_";

export class DuePaymentProcessor implements MessageProcessor {
  constructor(
    private readonly dueEntryRepository: IDueEntryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const msg = context.textMessage.toLowerCase();
    return msg.startsWith(MARK_PAID_PREFIX) || msg.startsWith(SNOOZE_PREFIX);
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const msg = context.textMessage.toLowerCase();
    let response: string;

    if (msg.startsWith(MARK_PAID_PREFIX)) {
      const id = context.textMessage.slice(MARK_PAID_PREFIX.length);
      const entry = await this.dueEntryRepository.findById(id);
      if (!entry || entry.charge.userId !== context.user.id) {
        response = "Due entry not found.";
      } else {
        await this.dueEntryRepository.markPaid(id, Number(entry.amount));
        response = `✅ Marked as paid — ₹${Number(entry.amount).toFixed(2)}`;
      }
    } else {
      const id = context.textMessage.slice(SNOOZE_PREFIX.length);
      const entry = await this.dueEntryRepository.findById(id);
      if (!entry || entry.charge.userId !== context.user.id) {
        response = "Due entry not found.";
      } else {
        await this.dueEntryRepository.snooze(id, 3);
        response = "⏰ Snoozed 3 days. I'll remind you again then.";
      }
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return {
      response,
      parsed: context.parsed ?? { intent: "CHAT" },
    };
  }
}
