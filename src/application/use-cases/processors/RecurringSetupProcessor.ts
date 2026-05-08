import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IRecurringChargeRepository } from "../../../domain/repositories/IRecurringChargeRepository";
import { IWalletRepository } from "../../../domain/repositories/IWalletRepository";
import { IDueEntryRepository } from "../../../domain/repositories/IDueEntryRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

export class RecurringSetupProcessor implements MessageProcessor {
  constructor(
    private readonly recurringChargeRepository: IRecurringChargeRepository,
    private readonly dueEntryRepository: IDueEntryRepository,
    private readonly walletRepository: IWalletRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "SET_RECURRING";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const details = parsed.recurring_details;

    if (!details) {
      const response =
        "I couldn't parse the recurring charge details. Try: 'remind me rent ₹8000 on 1st every month'";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    let walletId: string | undefined;
    if (details.walletName) {
      const wallet = await this.walletRepository.findByName(
        context.user.id,
        details.walletName,
      );
      walletId = wallet?.id;
    } else if (context.walletId) {
      walletId = context.walletId;
    }

    const charge = await this.recurringChargeRepository.create({
      userId: context.user.id,
      ...(walletId !== undefined && { walletId }),
      amount: details.amount,
      ...(details.amountMin !== undefined && { amountMin: details.amountMin }),
      ...(details.amountMax !== undefined && { amountMax: details.amountMax }),
      direction: details.direction,
      description: details.description,
      period: details.period,
      dayOfMonth: details.dayOfMonth,
    });

    // Create the first upcoming due entry
    const now = new Date();
    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      details.dayOfMonth,
    );
    if (dueDate <= now) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    await this.dueEntryRepository.create({
      chargeId: charge.id,
      ...(walletId !== undefined && { walletId }),
      dueDate,
      amount: details.amount,
    });

    const directionLabel =
      details.direction === "INCOME" ? "income" : "expense";
    const amountLabel = details.amountMin
      ? `₹${details.amountMin}–₹${details.amountMax ?? details.amount}`
      : `₹${details.amount}`;

    const response = `✅ *Recurring ${directionLabel} set!*\n\n📌 *${details.description}*\n💰 ${amountLabel} on the ${details.dayOfMonth}th every ${details.period.toLowerCase()}\n\nI'll remind you 2 days before it's due.`;

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
