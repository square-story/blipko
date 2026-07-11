import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IBoxRepository } from "../../../domain/repositories/IBoxRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { boxProgressLine } from "../boxFlow";
import { sanitizeMd } from "../budgetMath";

// Handles the plain "boxes"/"/boxes" command (pre-AI): lists the user's boxes
// with balance + progress toward each target.
export class BoxCommandProcessor implements MessageProcessor {
  constructor(
    private readonly boxRepository: IBoxRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "boxes" || normalized === "box";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const boxes = await this.boxRepository.listWithBalances(user.id);

    let body: string;
    if (boxes.length === 0) {
      body =
        'You have no boxes yet. Create a savings goal or fund in the dashboard, then add money with "add 5000 to <box>".';
    } else {
      const lines = boxes.map((b) => {
        const icon = b.icon ? `${b.icon} ` : "";
        return `${icon}${sanitizeMd(b.name)}\n📦 ${boxProgressLine(b, b.balance)}`;
      });
      body = `🎯 Your boxes\n\n${lines.join("\n\n")}`;
    }

    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "BOX", confidence: 1 } };
  }
}
