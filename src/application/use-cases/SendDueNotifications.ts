import { IDueEntryRepository } from "../../domain/repositories/IDueEntryRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { resolvePlatformUserId } from "../../utils/resolvePlatformUserId";

export class SendDueNotificationsUseCase {
  constructor(
    private readonly dueEntryRepository: IDueEntryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  async execute(): Promise<void> {
    const notifyBefore = 2;
    const upToDate = new Date();
    upToDate.setDate(upToDate.getDate() + notifyBefore);

    const entries = await this.dueEntryRepository.findUnnotified(upToDate);
    console.log(
      `SendDueNotifications: found ${entries.length} unnotified dues`,
    );

    for (const entry of entries) {
      const { charge } = entry;
      const platformUserId = resolvePlatformUserId(charge.user);
      if (!platformUserId) continue;

      // Mark notified BEFORE sending — prevents duplicate notifications
      // if multiple instances run concurrently. Prefer a silent miss over a
      // duplicate send.
      await this.dueEntryRepository.markNotified(entry.id);

      const daysUntil = Math.ceil(
        (entry.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const whenLabel =
        daysUntil <= 0
          ? "today"
          : daysUntil === 1
            ? "tomorrow"
            : `in ${daysUntil} days`;

      const body =
        `⏰ *Reminder: ${charge.description}*\n\n` +
        `💰 Amount: ₹${Number(charge.amount).toFixed(2)}\n` +
        `📅 Due ${whenLabel} (${entry.dueDate.toLocaleDateString("en-IN")})`;

      try {
        await this.messageService.sendInteractiveMessage(platformUserId, body, [
          { id: `mark_paid_${entry.id}`, title: "Mark as Paid" },
          { id: `snooze_${entry.id}`, title: "Snooze 3 Days" },
        ]);
      } catch (err) {
        console.error(`Failed to notify due entry ${entry.id}:`, err);
        // Do NOT unmark — prefer silent miss over duplicate send
      }
    }
  }
}
