import { MessageProcessor, ProcessContext, ProcessOutput } from "./MessageProcessor";
import { IMessageService } from "../../interfaces/IMessageService";

export class StartProcessor implements MessageProcessor {
    constructor(private readonly messageService: IMessageService) { }

    canHandle(context: ProcessContext): boolean {
        return context.textMessage.toLowerCase() === "start";
    }

    async process(context: ProcessContext): Promise<ProcessOutput> {
        const response = `👋 Hey ${context.user.name}! Welcome to Blipko! Tell me things like 'Gave 500 to Raju' or ask 'Balance for Raju' to track your ledger.`;

        await this.messageService.sendMessage({
            to: context.user.phoneNumber!,
            body: response,
        });

        return {
            response,
            parsed: { intent: "START", notes: "User initiated onboarding" },
        };
    }
}
