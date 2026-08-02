import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { sanitizeMd } from "../budgetMath";

// Handles the plain "recurring"/"/recurring" command (pre-AI): lists the user's
// recurring rules. Without this the registered /recurring menu entry falls all
// the way through to FallbackProcessor and answers "I didn't catch that".
export class RecurringCommandProcessor implements MessageProcessor {
  constructor(
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "recurring";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const rules = await this.recurringRuleRepository.findByUserId(user.id);
    const active = rules.filter((rule) => rule.isActive);

    let body: string;
    if (active.length === 0) {
      body =
        'You have no recurring rules yet. Tell me something like "rent 12000 every month" and I\'ll post it for you each month.';
    } else {
      const lines = active.map((rule) => {
        const label = rule.note
          ? sanitizeMd(rule.note)
          : rule.kind.toLowerCase();
        const direction = rule.kind === "INCOME" ? "+" : "-";
        return `${direction}₹${Number(rule.amount).toLocaleString("en-IN")} · ${label}\n📅 Day ${rule.dayOfMonth} of each month`;
      });
      body = `🔁 Your recurring rules\n\n${lines.join("\n\n")}\n\nManage them in the dashboard under Recurring.`;
    }

    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "RECURRING", confidence: 1 } };
  }
}
