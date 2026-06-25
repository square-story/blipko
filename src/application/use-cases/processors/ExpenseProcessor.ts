import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IIncomeRepository } from "../../../domain/repositories/IIncomeRepository";
import { IParseLogRepository } from "../../../domain/repositories/IParseLogRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { recordExpenseAndReply } from "../expenseFlow";
import { formatMoney } from "../budgetMath";

const CONFIDENCE_THRESHOLD = 0.6;
const MAX_AMOUNT = 10_000_000;

// Handles EXPENSE intent. On a confident parse it records the expense and shows
// remaining budget. When confidence is low or the bucket is ambiguous, it stages
// the parse in ParseLog and asks the user to pick a bucket (ConfirmBucketProcessor
// finishes the save).
export class ExpenseProcessor implements MessageProcessor {
  constructor(
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly parseLogRepository: IParseLogRepository,
    private readonly incomeRepository: IIncomeRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "EXPENSE";
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
        'Hmm, I couldn\'t catch the amount. Try something like "chai 30".';
      await this.messageService.sendMessage({
        to: platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    // Resolve category; a known category's bucket is authoritative.
    const matched = parsed.category
      ? await this.categoryRepository.findByNameForUser(
          user.id,
          parsed.category,
        )
      : null;
    const bucket = matched?.bucket ?? parsed.bucket;

    const needsConfirm = parsed.confidence < CONFIDENCE_THRESHOLD || !bucket;
    if (needsConfirm) {
      return this.askForBucket(context, amount);
    }

    const response = await recordExpenseAndReply(
      {
        expenseRepository: this.expenseRepository,
        categoryRepository: this.categoryRepository,
        budgetConfigRepository: this.budgetConfigRepository,
        incomeRepository: this.incomeRepository,
        messageService: this.messageService,
      },
      {
        user,
        platformUserId,
        amount,
        bucket,
        rawText: textMessage,
        confidence: parsed.confidence,
        note: parsed.note,
        categoryId: matched?.id,
        categoryName: matched?.name ?? parsed.category,
      },
    );
    return { response, parsed };
  }

  // Low-confidence: stage the parse and ask the user which bucket it belongs to.
  private async askForBucket(
    context: ProcessContext,
    amount: number,
  ): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const log = await this.parseLogRepository.create({
      rawText: context.textMessage,
      parsed,
      confidence: parsed.confidence,
      userId: context.user.id,
    });

    const body = `Got ${formatMoney(amount)} — which bucket?`;
    await this.messageService.sendInteractiveMessage(
      context.platformUserId,
      body,
      [
        [
          { id: `bkt:${log.id}:NEEDS`, title: "🏠 Need" },
          { id: `bkt:${log.id}:WANTS`, title: "🎯 Want" },
          { id: `bkt:${log.id}:SAVINGS`, title: "💰 Savings" },
        ],
      ],
    );
    return { response: body, parsed };
  }
}
