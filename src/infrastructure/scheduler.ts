import cron from "node-cron";
import { SendDueNotificationsUseCase } from "../application/use-cases/SendDueNotifications";
import { GenerateDueEntriesUseCase } from "../application/use-cases/GenerateDueEntries";
import { prisma } from "../data/prisma/client";

export function startScheduler(
  sendDueNotifications: SendDueNotificationsUseCase,
  generateDueEntries: GenerateDueEntriesUseCase,
): void {
  // Nightly at 1 AM IST (19:30 UTC) — runs BEFORE the 9 AM notification job
  cron.schedule(
    "30 19 * * *",
    async () => {
      console.log("Scheduler: running GenerateDueEntries");
      try {
        const result = await generateDueEntries.execute();
        console.log(
          `Scheduler: GenerateDueEntries done — ${result.created} created`,
        );
      } catch (err) {
        console.error("Scheduler: GenerateDueEntries failed", err);
      }
    },
    { noOverlap: true },
  );

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
    "Scheduler started — due generation at 1 AM IST, notifications at 9 AM IST, history pruning weekly",
  );
}
