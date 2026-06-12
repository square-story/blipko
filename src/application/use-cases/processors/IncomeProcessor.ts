import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import {
  BUCKET_META,
  bucketBudget,
  currentBudgetPeriod,
  effectiveMonthlyIncome,
  formatMoney,
  sanitizeMd,
} from "../budgetMath";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const MAX_AMOUNT = 1_000_000_000;

// Records an income event (salary, freelance, bonus) and replies with this
// month's effective income and the refreshed 50/30/20 bucket budgets. The
// budget grows as income lands (effectiveMonthlyIncome = max(expected, actual)).
export class IncomeProcessor implements MessageProcessor {
  constructor(
    private readonly incomeRepository: IIncomeRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "INCOME";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const { user, platformUserId, textMessage } = context;

    const amount = parsed.amount;
    if (typeof amount !== "number" || amount <= 0 || amount > MAX_AMOUNT) {
      const response =
        'Hmm, I couldn\'t catch the income amount. Try something like "got salary 50000".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    await this.incomeRepository.create({
      userId: user.id,
      amount,
      rawText: textMessage,
      confidence: parsed.confidence,
      source: parsed.note,
      note: parsed.note,
    });

    // Refresh the month's effective income + budgets (sum already includes the new income).
    const { start, end } = currentBudgetPeriod(user.payday);
    const monthIncome = await this.incomeRepository.sumForMonth(
      user.id,
      start,
      end,
    );
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const expected = Number(user.monthlyIncome ?? 0);
    const effective = effectiveMonthlyIncome(expected, monthIncome);

    const label = parsed.note ? ` (${sanitizeMd(parsed.note)})` : "";
    const response = `✅ Income ${formatMoney(amount)}${label}
This month: ${formatMoney(effective)} → ${BUCKET_META.NEEDS.emoji} Needs ${formatMoney(bucketBudget(effective, config, "NEEDS"))} · ${BUCKET_META.WANTS.emoji} Wants ${formatMoney(bucketBudget(effective, config, "WANTS"))} · ${BUCKET_META.SAVINGS.emoji} Savings ${formatMoney(bucketBudget(effective, config, "SAVINGS"))}`;

    await this.messageService.sendMessage({
      to: platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
