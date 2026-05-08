import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IContactRepository } from "../../../domain/repositories/IContactRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

export class QueryProcessor implements MessageProcessor {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly contactRepository: IContactRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "QUERY";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const details = context.parsed?.query_details;
    const userId = context.user.id;
    let responseText =
      "I couldn't understand your query. Try asking 'Who hasn't paid?' or 'What's [name]'s balance?'";

    if (!details?.type) {
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: responseText,
      });
      return { response: responseText, parsed: context.parsed! };
    }

    switch (details.type) {
      case "CONTACT_BALANCE": {
        const name = details.contactName;
        if (!name) {
          responseText = "Which contact's balance do you want to check?";
          break;
        }
        const contact = await this.contactRepository.findSimilarByName(
          userId,
          name,
        );
        if (!contact) {
          responseText = `I couldn't find a contact named "${name}".`;
          break;
        }
        const balance = Number(contact.currentBalance);
        if (balance > 0) {
          responseText = `${contact.name}'s balance: ₹${balance.toFixed(2)} (you paid them more than received).`;
        } else if (balance < 0) {
          responseText = `${contact.name} owes you ₹${Math.abs(balance).toFixed(2)}.`;
        } else {
          responseText = `${contact.name} is fully settled — balance is ₹0.`;
        }
        break;
      }

      case "UNPAID_CONTACTS": {
        const unpaid =
          await this.transactionRepository.findUnpaidContacts(userId);
        if (unpaid.length === 0) {
          responseText = "Everyone is settled up! No outstanding balances.";
          break;
        }
        const lines = unpaid
          .slice(0, 10)
          .map(
            (c) =>
              `• ${c.contactName}: owes ₹${Math.abs(c.balance).toFixed(2)}`,
          );
        responseText = `Contacts with pending balances:\n${lines.join("\n")}`;
        break;
      }

      case "TOTAL_SPEND": {
        const period = details.period ?? "THIS_MONTH";
        const { startDate } = this.getPeriodDates(period);
        const transactions =
          await this.transactionRepository.findByUser(userId);
        const filtered = transactions.filter(
          (tx) => tx.intent === "CREDIT" && new Date(tx.date) >= startDate,
        );
        const total = filtered.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const periodLabel = this.periodLabel(period);
        if (details.category) {
          const catFiltered = filtered.filter(
            (tx) =>
              tx.category?.toLowerCase() === details.category!.toLowerCase(),
          );
          const catTotal = catFiltered.reduce(
            (sum, tx) => sum + Number(tx.amount),
            0,
          );
          responseText = `You spent ₹${catTotal.toFixed(2)} on ${details.category} ${periodLabel}.`;
        } else {
          responseText = `Total spend ${periodLabel}: ₹${total.toFixed(2)}.`;
        }
        break;
      }

      case "TOTAL_INCOME": {
        const period = details.period ?? "THIS_MONTH";
        const { startDate } = this.getPeriodDates(period);
        const transactions =
          await this.transactionRepository.findByUser(userId);
        const filtered = transactions.filter(
          (tx) => tx.intent === "DEBIT" && new Date(tx.date) >= startDate,
        );
        const total = filtered.reduce((sum, tx) => sum + Number(tx.amount), 0);
        responseText = `Total income ${this.periodLabel(period)}: ₹${total.toFixed(2)}.`;
        break;
      }

      case "NET_BALANCE": {
        const transactions =
          await this.transactionRepository.findByUser(userId);
        let net = 0;
        for (const tx of transactions) {
          if (tx.intent === "CREDIT") net += Number(tx.amount);
          else if (tx.intent === "DEBIT") net -= Number(tx.amount);
        }
        responseText =
          net >= 0
            ? `Your net balance: ₹${net.toFixed(2)} (you're in the positive).`
            : `Your net balance: -₹${Math.abs(net).toFixed(2)} (you owe more than you've received).`;
        break;
      }

      default:
        responseText =
          "Use the dashboard for detailed analytics. I can currently answer: contact balance, who hasn't paid, total spend/income.";
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: responseText,
    });

    return {
      response: responseText,
      parsed: context.parsed!,
    };
  }

  private getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case "TODAY":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "THIS_WEEK":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case "ALL_TIME":
        startDate = new Date(0);
        break;
      case "THIS_MONTH":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  }

  private periodLabel(period: string): string {
    switch (period) {
      case "TODAY":
        return "today";
      case "THIS_WEEK":
        return "this week";
      case "ALL_TIME":
        return "all time";
      default:
        return "this month";
    }
  }
}
