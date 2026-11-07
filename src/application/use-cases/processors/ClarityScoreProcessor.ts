import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IClarityScoreRepository } from "../../../domain/repositories/IClarityScoreRepository";
import { parseClarityCallback } from "../clarityCallback";

// Records the 1–5 "how sure are you about where your money went?" tap sent
// after each cycle report. The answer is the toast; no chat message.
export class ClarityScoreProcessor implements MessageProcessor {
  constructor(
    private readonly clarityScoreRepository: IClarityScoreRepository,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return parseClarityCallback(context.textMessage) !== null;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { cycleKey, score } = parseClarityCallback(context.textMessage)!;
    await this.clarityScoreRepository.record(context.user.id, cycleKey, score);
    return {
      response: `clarity ${score}/5`,
      parsed: { intent: "UNKNOWN", confidence: 1 },
      toast: "Thanks — noted 🙏",
      historyText: `[rated clarity ${score}/5]`,
    };
  }
}
