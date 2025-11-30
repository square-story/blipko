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

  async sendMessage(payload: SendMessagePayload): Promise<void> {
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

  async sendReaction(
    messageId: string,
    emoji: string,
    to: string,
  ): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "reaction",
        reaction: {
          message_id: messageId,
          emoji: emoji,
        },
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");
      console.error(
        `Failed to send reaction to ${messageId}: ${response.status} ${errorDetails}`,
      );
    }
  }
}
