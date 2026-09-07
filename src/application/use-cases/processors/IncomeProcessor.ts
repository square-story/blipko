import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { INCOME_FALLBACK_CATEGORY } from "../../../domain/incomeCategoryTemplate";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { txnCb } from "../txnCallback";
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

// Records an income event and replies with this cycle's effective income and the
// refreshed bucket budgets. The budget grows as EARNED income lands
// (effectiveMonthlyIncome = max(expected, earned)) — a refund or a repaid loan is
// still recorded and still reported, but does not widen the budget.
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
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT
    ) {
      const response =
        'Hmm, I couldn\'t catch the income amount. Try something like "got salary 50000".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    // Resolve the parser's category name against the user's real rows (loaded
    // upstream for the prompt). An unknown or missing name lands on the fallback,
    // which counts as earnings — the behaviour from before the taxonomy existed.
    const all = context.incomeCategories ?? [];
    const wanted = parsed.category?.trim().toLowerCase();
    const category =
      (wanted && all.find((c) => c.name.toLowerCase() === wanted)) ||
      all.find((c) => c.name === INCOME_FALLBACK_CATEGORY);

    const income = await this.incomeRepository.create({
      userId: user.id,
      amount,
      rawText: textMessage,
      confidence: parsed.confidence,
      source: parsed.note,
      note: parsed.note,
      categoryId: category?.id,
    });

    // Two sums, deliberately: gross is what landed and is what we report back;
    // earned is what the budget is built on. A refund moves the first, not the second.
    const { start, end } = currentBudgetPeriod(user.payday);
    const [grossIncome, monthIncome] = await Promise.all([
      this.incomeRepository.sumForMonth(user.id, start, end),
      this.incomeRepository.sumEarnedForMonth(user.id, start, end),
    ]);
    const config =
      (await this.budgetConfigRepository.findByUserId(user.id)) ??
      DEFAULT_SPLIT;
    const expected = Number(user.monthlyIncome ?? 0);
    const effective = effectiveMonthlyIncome(expected, monthIncome);

    const label = parsed.note ? ` (${sanitizeMd(parsed.note)})` : "";
    // Say so explicitly, otherwise the budget line looks broken: money went in
    // and nothing moved.
    const notEarned =
      (category?.countsAsEarnings ?? true)
        ? ""
        : "\n↩️ Money coming back, not new income — your budget is unchanged.";
    const response = `✅ Income ${formatMoney(amount)}${label}${notEarned}
💵 Income this cycle: ${formatMoney(grossIncome)}
Budget on ${formatMoney(effective)} → ${BUCKET_META.NEEDS.emoji} Needs ${formatMoney(bucketBudget(effective, config, "NEEDS"))} · ${BUCKET_META.WANTS.emoji} Wants ${formatMoney(bucketBudget(effective, config, "WANTS"))} · ${BUCKET_META.SAVINGS.emoji} Savings ${formatMoney(bucketBudget(effective, config, "SAVINGS"))}`;

    // Send with quick-action buttons + store the message id so the user can
    // reply to (or tap) this confirmation to edit/delete the income later.
    const messageId = await this.messageService.sendInteractiveMessage(
      platformUserId,
      response,
      [
        [
          { id: txnCb.hintedit("income", income.id), title: "✏️ Edit" },
          { id: txnCb.askdel("income", income.id), title: "🗑 Delete" },
        ],
      ],
    );
    if (messageId) {
      await this.incomeRepository.updateConfirmationMessageId(
        income.id,
        messageId,
      );
    }
    return { response, parsed };
  }
}
