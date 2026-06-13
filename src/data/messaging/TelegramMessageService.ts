import {
  IMessagingPlatform,
  SendMessagePayload,
  InlineButtonRows,
} from "../../application/interfaces/IMessagingPlatform";
import { env } from "../../config/env";

export class TelegramMessageService implements IMessagingPlatform {
  private readonly base: string;

  constructor(token: string = env.TELEGRAM_BOT_TOKEN) {
    this.base = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(payload: SendMessagePayload): Promise<string> {
    const res = await fetch(`${this.base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.to,
        text: payload.body,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Telegram sendMessage failed ${res.status}: ${err}`);
    }
    const data = (await res.json()) as { result?: { message_id?: number } };
    return String(data.result?.message_id ?? "");
  }

  async sendTypingIndicator(platformUserId: string): Promise<void> {
    await fetch(`${this.base}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: platformUserId, action: "typing" }),
    }).catch(() => {});
  }

  async sendInteractiveMessage(
    to: string,
    body: string,
    rows: InlineButtonRows,
  ): Promise<string> {
    const inline_keyboard = rows.map((row) =>
      row.map((b) => ({ text: b.title, callback_data: b.id })),
    );
    const res = await fetch(`${this.base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: to,
        text: body,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(
        `Telegram sendInteractiveMessage failed ${res.status}: ${err}`,
      );
    }
    const data = (await res.json()) as { result?: { message_id?: number } };
    return String(data.result?.message_id ?? "");
  }

  async editInteractiveMessage(
    to: string,
    messageId: string,
    body: string,
    rows: InlineButtonRows,
  ): Promise<void> {
    const inline_keyboard = rows.map((row) =>
      row.map((b) => ({ text: b.title, callback_data: b.id })),
    );
    const res = await fetch(`${this.base}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: to,
        message_id: Number(messageId),
        text: body,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard },
      }),
    });
    // Telegram returns 400 "message is not modified" on a no-op edit — ignore.
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`Telegram editMessageText ${res.status}: ${err}`);
    }
  }

  async acknowledgeInteraction(callbackQueryId: string): Promise<void> {
    await fetch(`${this.base}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    }).catch(() => {});
  }
}
