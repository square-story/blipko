import cron from "node-cron";
import { SendDueNotificationsUseCase } from "../application/use-cases/SendDueNotifications";
import { prisma } from "../data/prisma/client";

export function startScheduler(
  sendDueNotifications: SendDueNotificationsUseCase,
): void {
  // Daily at 9 AM IST (3:30 AM UTC)
  cron.schedule("30 3 * * *", async () => {
    console.log("Scheduler: running SendDueNotifications");
    try {
      await sendDueNotifications.execute();
    } catch (err) {
      console.error("Scheduler: SendDueNotifications failed", err);
    }
  });

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

  console.log(
    "Scheduler started — due notifications at 9 AM IST, history pruning weekly",
  );
}
