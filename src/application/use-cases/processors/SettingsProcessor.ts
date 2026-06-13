import { NotificationDosage } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import { formatMoney } from "../budgetMath";

const DOSAGE_LABEL: Record<NotificationDosage, string> = {
  OFF: "No reminders",
  GENTLE: "Gentle (1–2 a day)",
  AGGRESSIVE: "Aggressive",
  RELENTLESS: "Relentless",
};

const VALID: NotificationDosage[] = [
  "OFF",
  "GENTLE",
  "AGGRESSIVE",
  "RELENTLESS",
];

// `/settings`: shows current income + reminder dosage and lets the user change
// the dosage via buttons (`set:dose:<LEVEL>`). Deeper edits (categories, budgets)
// live on the web dashboard. Runs before AI parsing.
export class SettingsProcessor implements MessageProcessor {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    if (context.textMessage.startsWith("set:")) return true;
    const normalized = context.textMessage
      .trim()
      .toLowerCase()
      .replace(/^\//, "");
    return normalized === "settings";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage, callbackMessageId } = context;

    if (textMessage.startsWith("set:dose:")) {
      const level = textMessage.split(":")[2] as NotificationDosage;
      const dosage = VALID.includes(level) ? level : "OFF";
      await this.userRepository.update(user.id, {
        notificationDosage: dosage,
      });
      const body = `✅ Reminders set to *${DOSAGE_LABEL[dosage]}*.`;
      if (callbackMessageId && this.messageService.editInteractiveMessage) {
        await this.messageService.editInteractiveMessage(
          platformUserId,
          callbackMessageId,
          body,
          [],
        );
      } else {
        await this.messageService.sendMessage({ to: platformUserId, body });
      }
      return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
    }

    const current = user.notificationDosage;
    const body = `⚙️ *Your settings*
Income: ${formatMoney(Number(user.monthlyIncome ?? 0))}/mo
Reminders: ${DOSAGE_LABEL[current]}

Pick a reminder level (edit categories & budgets on the web):`;
    await this.messageService.sendInteractiveMessage(
      platformUserId,
      body,
      dosageKeyboard(current),
    );
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}

function dosageKeyboard(current: NotificationDosage): InlineButtonRows {
  const mark = (d: NotificationDosage, label: string) =>
    `${current === d ? "✅ " : ""}${label}`;
  return [
    [
      { id: "set:dose:OFF", title: mark("OFF", "😴 Off") },
      { id: "set:dose:GENTLE", title: mark("GENTLE", "🔔 Gentle") },
    ],
    [
      { id: "set:dose:AGGRESSIVE", title: mark("AGGRESSIVE", "⚡ Aggressive") },
      {
        id: "set:dose:RELENTLESS",
        title: mark("RELENTLESS", "🔥 Relentless"),
      },
    ],
  ];
}
