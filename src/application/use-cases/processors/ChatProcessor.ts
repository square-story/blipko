import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

export class ChatProcessor implements MessageProcessor {
  constructor(private readonly messageService: IMessagingPlatform) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "CHAT";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const responseText =
      context.parsed?.conversational_response ??
      "Hello! I am here to help you track your finances.";

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: responseText,
    });

    return {
      response: responseText,
      parsed: context.parsed!,
    };
  }
}
