import { Bucket } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IRecurringRuleRepository } from "../../../domain/repositories/IRecurringRuleRepository";
import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { BUCKET_META, formatMoney, sanitizeMd } from "../budgetMath";

const MAX_AMOUNT = 1_000_000_000;

// Handles the RECURRING intent: sets up a repeating income/expense the daily job
// auto-logs each month. Resolves category/bucket like ExpenseProcessor.
export class RecurringSetupProcessor implements MessageProcessor {
  constructor(
    private readonly recurringRuleRepository: IRecurringRuleRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "RECURRING";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const { user, platformUserId } = context;

    const amount = parsed.amount;
    if (typeof amount !== "number" || amount <= 0 || amount > MAX_AMOUNT) {
      return this.reply(
        platformUserId,
        'I couldn\'t catch the amount. Try "rent 8000 on 1st every month".',
      );
    }

    const day = parsed.dayOfMonth;
    if (typeof day !== "number" || day < 1 || day > 28) {
      return this.reply(
        platformUserId,
        'Which day each month? Try "rent 8000 on 1st every month" (1–28).',
      );
    }

    const kind = parsed.recurringKind ?? "EXPENSE";

    if (kind === "INCOME") {
      const rule = await this.recurringRuleRepository.create({
        userId: user.id,
        kind: "INCOME",
        amount,
        dayOfMonth: day,
        note: parsed.note,
      });
      return this.finish(
        platformUserId,
        rule.id,
        day,
        `🔁 Recurring income set: ${formatMoney(amount)}${parsed.note ? ` (${sanitizeMd(parsed.note)})` : ""} on day ${day} — I'll auto-log it each month.`,
      );
    }

    // EXPENSE: resolve category; a known category's bucket is authoritative.
    const matched = parsed.category
      ? await this.categoryRepository.findByNameForUser(
          user.id,
          parsed.category,
        )
      : null;
    const bucket: Bucket = matched?.bucket ?? parsed.bucket ?? "NEEDS";
    let categoryId = matched?.id;
    let categoryName = matched?.name ?? parsed.category;
    if (!categoryId && parsed.category) {
      const created = await this.categoryRepository.create({
        userId: user.id,
        name: parsed.category,
        bucket,
      });
      categoryId = created.id;
      categoryName = created.name;
    }

    const rule = await this.recurringRuleRepository.create({
      userId: user.id,
      kind: "EXPENSE",
      amount,
      dayOfMonth: day,
      bucket,
      categoryId,
      note: parsed.note,
    });

    const where = categoryName ? ` · ${sanitizeMd(categoryName)}` : "";
    return this.finish(
      platformUserId,
      rule.id,
      day,
      `🔁 Recurring set: ${formatMoney(amount)} → ${BUCKET_META[bucket].label}${where} on day ${day} — I'll auto-log it each month.`,
    );
  }

  // If the rule's day already passed this calendar month, the daily cron would
  // post it on its next run — so ask the user whether to add it for this month
  // now (Yes), or skip to next month (No, which marks it posted). Future day →
  // just confirm; the cron posts it on the day.
  private async finish(
    platformUserId: string,
    ruleId: string,
    dayOfMonth: number,
    baseMsg: string,
  ): Promise<ProcessOutput> {
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const dueDay = Math.min(dayOfMonth, daysInMonth);

    if (now.getDate() >= dueDay) {
      const body = `${baseMsg}\n\nDay ${dayOfMonth} already passed this month — add it for this month now too?`;
      await this.messageService.sendInteractiveMessage(platformUserId, body, [
        { id: `rec:${ruleId}:yes`, title: "✅ Add this month" },
        { id: `rec:${ruleId}:no`, title: "No, next month" },
      ]);
      return { response: body, parsed: { intent: "RECURRING", confidence: 1 } };
    }

    return this.reply(platformUserId, baseMsg);
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "RECURRING", confidence: 1 } };
  }
}
