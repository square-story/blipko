import { MessageProcessor, ProcessContext, ProcessOutput } from "./MessageProcessor";
import { ITransactionRepository } from "../../../domain/repositories/ITransactionRepository";
import { IContactRepository } from "../../../domain/repositories/IContactRepository";
import { IMessageService } from "../../interfaces/IMessageService";
import { totalBalance } from "../../../utils/totalBalance";

export class BalanceProcessor implements MessageProcessor {
    constructor(
        private readonly transactionRepository: ITransactionRepository,
        private readonly contactRepository: IContactRepository,
        private readonly messageService: IMessageService,
    ) { }

    canHandle(context: ProcessContext): boolean {
        return context.parsed?.intent === "BALANCE";
    }

    async process(context: ProcessContext): Promise<ProcessOutput> {
        const parsed = context.parsed!;
        if (!parsed.name) {
            const response =
                "Please specify a contact name to check balance (e.g., 'Balance for Raju')";
            await this.messageService.sendMessage({
                to: context.user.phoneNumber!,
                body: response,
            });
            return { response, parsed };
        }

        const contact = await this.contactRepository.findByName(
            context.user.id,
            parsed.name,
        );

        if (!contact) {
            const response = `You don't have any records with ${parsed.name} yet.`;
            await this.messageService.sendMessage({
                to: context.user.phoneNumber!,
                body: response,
            });
            return { response, parsed };
        }

        const contactTransactions = await this.transactionRepository.findByContact(
            contact.id,
        );

        const threeTransactions =
            await this.transactionRepository.findThreeTransactions({
                userId: context.user.id,
                contactId: contact.id,
            });

        const balance = totalBalance(contactTransactions);

        const response = `👤 *Customer Report: ${contact.name}*

💰 *Current Balance:* ₹${balance.toFixed(2)} ${balance < 0 ? "🔴 (Due)" : "🟢 (Credit)"}
📉 *Recent History:*

${threeTransactions
                .map((t) => {
                    const type = t.intent === "CREDIT" ? "Gave" : "Received";
                    return `- ${type} ₹${t.amount.toFixed(2)} on ${t.date.toISOString().split("T")[0]}${t.description ? ` (${t.description})` : ""}`;
                })
                .join("\n\n")}

_Reply with "Statement ${contact.name}" for full PDF._
`;
        await this.messageService.sendMessage({
            to: context.user.phoneNumber!,
            body: response,
        });

        return { response, parsed };
    }
}
