import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IBoxRepository } from "../../domain/repositories/IBoxRepository";
import { IMessagingPlatform } from "../interfaces/IMessagingPlatform";
import { formatMoney, sanitizeMd } from "./budgetMath";

export interface SendBoxTargetAlertsResult {
  sent: number;
}

// Cron sweep: when a box's balance first reaches its target, DM the user once.
// Idempotent via Box.targetReachedAt (stamped atomically before sending), so a
// box funded from the web dashboard still gets exactly one push. Boxes funded
// over the bot are alerted inline and already stamped, so they're skipped here.
export class SendBoxTargetAlertsUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly boxRepository: IBoxRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  async execute(): Promise<SendBoxTargetAlertsResult> {
    const users = await this.userRepository.findOnboardedWithTelegram();

    let sent = 0;
    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        const boxes = await this.boxRepository.goalBoxesPendingAlert(user.id);
        for (const box of boxes) {
          // Stamp first — only the winning call sends, so we never double-fire.
          const stamped = await this.boxRepository.markTargetReached(box.id);
          if (!stamped) continue;
          const icon = box.icon ? `${box.icon} ` : "";
          const body = `🎉 Goal reached! ${icon}${sanitizeMd(box.name)} hit its ${formatMoney(
            Number(box.targetAmount ?? 0),
          )} target — you've saved ${formatMoney(box.balance)}.`;
          await this.messageService.sendMessage({
            to: user.telegramId,
            body,
          });
          sent++;
        }
      } catch (err) {
        // One user's failure must not abort the batch.
        console.error(`Box target alert failed for user ${user.id}:`, err);
      }
    }
    return { sent };
  }
}
