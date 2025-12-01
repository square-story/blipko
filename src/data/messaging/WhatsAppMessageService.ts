import {
  IMessageService,
  SendMessagePayload,
} from "../../application/interfaces/IMessageService";
import { env } from "../../config/env";

const DEFAULT_GRAPH_API_BASE = "https://graph.facebook.com";

export class WhatsAppMessageService implements IMessageService {
  private readonly endpoint: string;

  constructor(
    private readonly phoneNumberId: string = env.WHATSAPP_PHONE_NUMBER_ID,
    private readonly accessToken: string = env.META_WHATSAPP_TOKEN,
    private readonly graphVersion: string = env.WHATSAPP_GRAPH_VERSION,
    graphBase: string = DEFAULT_GRAPH_API_BASE,
  ) {
    this.endpoint = `${graphBase}/${this.graphVersion}/${this.phoneNumberId}/messages`;
  }

  async sendMessage(payload: SendMessagePayload): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: payload.to,
        type: "text",
        text: {
          body: payload.body,
          preview_url: false,
        },
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");
      throw new Error(
        `WhatsAppMessageService failed with status ${response.status} ${errorDetails}`,
      );
    }

    const data = (await response.json()) as { messages?: { id: string }[] };
    return data.messages?.[0]?.id || "";
  }

  async markAsRead(messageId: string): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");
      console.error(
        `Failed to mark message ${messageId} as read: ${response.status} ${errorDetails}`,
      );
    }
  }

  async sendTypingIndicator(messageId: string): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: {
          type: "text",
        },
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");
      console.error(
        `Failed to send typing indicator for ${messageId}: ${response.status} ${errorDetails}`,
      );
    }
  }

  async sendInteractiveMessage(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
  ): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: body,
          },
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: {
                id: btn.id,
                title: btn.title,
              },
            })),
          },
        },
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");
      throw new Error(
        `WhatsAppMessageService failed to send interactive message: ${response.status} ${errorDetails}`,
      );
    }

    const data = (await response.json()) as { messages?: { id: string }[] };
    return data.messages?.[0]?.id || "";
  }
}
