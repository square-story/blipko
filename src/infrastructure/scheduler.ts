import cron from "node-cron";
import { prisma } from "../data/prisma/client";

export function startScheduler(): void {
  // Weekly conversation history pruning (Sunday midnight UTC)
  cron.schedule("0 0 * * 0", async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const { count } = await prisma.conversationMessage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      console.log(`Scheduler: pruned ${count} old conversation messages`);
    } catch (err) {
      console.error("Scheduler: conversation pruning failed", err);
    }
  });

  console.log("Scheduler started — conversation history pruning weekly");
}
