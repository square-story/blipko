import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IBoxRepository } from "../../../domain/repositories/IBoxRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { recordBoxEntry, boxEntryReply } from "../boxFlow";

const MAX_AMOUNT = 1_000_000_000;

// Handles the BOX intent: a direct contribution to / withdrawal from a named
// box ("add 5000 to New York", "took 2000 from house fund"). Boxes are created
// in the dashboard — this only moves money in/out of an existing one.
export class BoxProcessor implements MessageProcessor {
  constructor(
    private readonly boxRepository: IBoxRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "BOX";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const { user, platformUserId, textMessage } = context;

    const amount = parsed.amount;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT
    ) {
      const response =
        'Hmm, I couldn\'t catch the amount. Try "add 5000 to New York".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const name = parsed.boxName?.trim();
    if (!name) {
      const response =
        'Which box? Try "add 5000 to New York" or "spent 2000 from house fund".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const box = await this.boxRepository.findByNameForUser(user.id, name);
    if (!box) {
      const response = `I couldn't find a box called "${name}". Create it in the dashboard, then add money to it.`;
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    const direction = parsed.boxDirection === "OUT" ? "OUT" : "IN";
    const result = await recordBoxEntry(this.boxRepository, {
      box,
      userId: user.id,
      amount,
      direction,
      source: "MANUAL",
      note: parsed.note,
      rawText: textMessage,
    });

    const response = boxEntryReply(box, amount, direction, result);
    await this.messageService.sendMessage({
      to: platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
