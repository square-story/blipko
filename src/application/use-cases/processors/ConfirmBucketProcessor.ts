import { Bucket } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IExpenseRepository } from "../../../domain/repositories/IExpenseRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import { IParseLogRepository } from "../../../domain/repositories/IParseLogRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { ParsedData } from "../../../domain/entities/ParsedData";
import { recordExpenseAndReply } from "../expenseFlow";

const VALID_BUCKETS: Bucket[] = ["NEEDS", "WANTS", "SAVINGS"];

// Handles the bucket-confirmation button press (callback "bkt:<parseLogId>:<BUCKET>").
// Loads the staged parse from ParseLog and records the expense with the chosen
// bucket. Runs before AI parsing.
export class ConfirmBucketProcessor implements MessageProcessor {
  constructor(
    private readonly parseLogRepository: IParseLogRepository,
    private readonly expenseRepository: IExpenseRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.textMessage.startsWith("bkt:");
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { platformUserId } = context;
    const [, parseLogId, bucketRaw] = context.textMessage.split(":");
    const bucket = bucketRaw as Bucket;

    if (!parseLogId || !VALID_BUCKETS.includes(bucket)) {
      return this.fail(platformUserId);
    }

    const log = await this.parseLogRepository.findById(parseLogId);
    if (!log) {
      return this.fail(platformUserId);
    }

    const parsed = log.parsed as unknown as ParsedData;
    const amount = parsed.amount;
    if (typeof amount !== "number" || amount <= 0) {
      return this.fail(platformUserId);
    }

    const response = await recordExpenseAndReply(
      {
        expenseRepository: this.expenseRepository,
        categoryRepository: this.categoryRepository,
        budgetConfigRepository: this.budgetConfigRepository,
        messageService: this.messageService,
      },
      {
        user: context.user,
        platformUserId,
        amount,
        bucket,
        rawText: log.rawText,
        confidence: parsed.confidence,
        note: parsed.note,
        categoryName: parsed.category,
        parseLogId: log.id,
      },
    );
    return { response, parsed };
  }

  private async fail(platformUserId: string): Promise<ProcessOutput> {
    const response =
      "That entry expired — please send the expense again.";
    await this.messageService.sendMessage({ to: platformUserId, body: response });
    return { response, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}
