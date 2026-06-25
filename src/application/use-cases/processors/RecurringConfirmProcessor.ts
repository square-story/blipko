import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { RunInTransaction } from "../../../domain/repositories/UnitOfWork";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { postRecurringRule } from "../postRecurringRule";

// Handles the "add this recurring item for the current month?" button
// (callback "rec:<ruleId>:yes|no") shown by RecurringSetupProcessor when the
// rule's day already passed. Runs before AI parsing.
export class RecurringConfirmProcessor implements MessageProcessor {
  constructor(
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly messageService: IMessagingPlatform,
    private readonly runTransaction: RunInTransaction,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.textMessage.startsWith("rec:");
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { platformUserId } = context;
    const [, ruleId, choice] = context.textMessage.split(":");

    const rule = ruleId
      ? await this.recurringRuleRepository.findById(ruleId)
      : null;
    if (!rule) {
      return this.reply(
        platformUserId,
        "That recurring item is no longer set up.",
      );
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (choice === "yes") {
      const summary = await postRecurringRule(
        {
          recurringRuleRepository: this.recurringRuleRepository,
          expenseRepository: this.expenseRepository,
          incomeRepository: this.incomeRepository,
          categoryRepository: this.categoryRepository,
          runTransaction: this.runTransaction,
        },
        rule,
        monthKey,
      );
      return this.reply(platformUserId, `✅ Added for this month: ${summary}.`);
    }

    // "No": mark posted for this month so the daily cron doesn't add it anyway;
    // it resumes normally next month.
    await this.recurringRuleRepository.markPosted(rule.id, monthKey);
    return this.reply(
      platformUserId,
      "👍 Got it — it'll start from next month.",
    );
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}
