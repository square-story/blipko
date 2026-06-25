import cron from "node-cron";
import { prisma } from "../data/prisma/client";
import { SendBudgetNudgesUseCase } from "../application/use-cases/SendBudgetNudges";
import { PostRecurringChargesUseCase } from "../application/use-cases/PostRecurringCharges";
import { logger } from "../utils/logger";

const log = logger.child({ component: "scheduler" });

export function startScheduler(
  sendBudgetNudges: SendBudgetNudgesUseCase,
  postRecurringCharges: PostRecurringChargesUseCase,
): void {
  // Daily recurring auto-post at 6 AM IST (00:30 UTC).
  cron.schedule("30 0 * * *", async () => {
    try {
      const { posted } = await postRecurringCharges.execute();
      log.info("PostRecurringCharges complete", { job: "recurring", posted });
    } catch (err) {
      log.error("PostRecurringCharges failed", { job: "recurring", err });
    }
  });

  // Daily budget nudges at 7 PM IST (13:30 UTC).
  cron.schedule("30 13 * * *", async () => {
    try {
      const { sent } = await sendBudgetNudges.execute();
      log.info("SendBudgetNudges complete", { job: "nudges", sent });
    } catch (err) {
      log.error("SendBudgetNudges failed", { job: "nudges", err });
    }
  });

  // Weekly pruning of stale rows (Sunday midnight UTC). Conversation history
  // older than 7 days, and the idempotency ledger past the retry window (it
  // would otherwise grow unbounded; Telegram only retries for a few hours).
  cron.schedule("0 0 * * 0", async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const { count } = await prisma.conversationMessage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      log.info("Pruned old conversation messages", { job: "prune", count });
    } catch (err) {
      log.error("Conversation pruning failed", { job: "prune", err });
    }
    try {
      const { count } = await prisma.processedMessage.deleteMany({
        where: { processedAt: { lt: cutoff } },
      });
      log.info("Pruned old processed-message records", { job: "prune", count });
    } catch (err) {
      log.error("Processed-message pruning failed", { job: "prune", err });
    }
  });

  log.info("Scheduler started", {
    recurring: "00:30 UTC",
    nudges: "13:30 UTC",
    prune: "Sun 00:00 UTC",
  });
}
