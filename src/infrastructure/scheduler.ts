import cron from "node-cron";
import { SendDueNotificationsUseCase } from "../application/use-cases/SendDueNotifications";

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
  console.log("Scheduler started — due notifications fire daily at 9 AM IST");
}
