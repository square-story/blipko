import {
  IMessageService,
  SendMessagePayload,
} from '../../application/interfaces/IMessageService';
import { env } from '../../config/env';

export class WhatsAppMessageService implements IMessageService {
  constructor(private readonly mockUrl: string = env.WHATSAPP_MESSAGE_MOCK_URL) {}

  async sendMessage(payload: SendMessagePayload): Promise<void> {
    const response = await fetch(this.mockUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        message: payload.body,
        provider: 'meta.whatsapp.mock',
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsAppMessageService failed with status ${response.status}`);
    }
  }
}


