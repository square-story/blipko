import cron from "node-cron";
import { prisma } from "../data/prisma/client";
import { SendBudgetNudgesUseCase } from "../application/use-cases/SendBudgetNudges";
import { PostRecurringChargesUseCase } from "../application/use-cases/PostRecurringCharges";

export function startScheduler(
  sendBudgetNudges: SendBudgetNudgesUseCase,
  postRecurringCharges: PostRecurringChargesUseCase,
): void {
  // Daily recurring auto-post at 6 AM IST (00:30 UTC).
  cron.schedule("30 0 * * *", async () => {
    console.log("Scheduler: running PostRecurringCharges");
    try {
      const { posted } = await postRecurringCharges.execute();
      console.log(`Scheduler: PostRecurringCharges posted ${posted} item(s)`);
    } catch (err) {
      console.error("Scheduler: PostRecurringCharges failed", err);
    }
  });

  // Daily budget nudges at 7 PM IST (13:30 UTC).
  cron.schedule("30 13 * * *", async () => {
    console.log("Scheduler: running SendBudgetNudges");
    try {
      const { sent } = await sendBudgetNudges.execute();
      console.log(`Scheduler: SendBudgetNudges sent ${sent} nudge(s)`);
    } catch (err) {
      console.error("Scheduler: SendBudgetNudges failed", err);
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
    "Scheduler started — recurring auto-post 6 AM IST, budget nudges 7 PM IST, history pruning weekly",
  );
}
