export interface SendMessagePayload {
  to: string;
  body: string;
}

export interface IMessageService {
  sendMessage(payload: SendMessagePayload): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
  sendReaction(messageId: string, emoji: string, to: string): Promise<void>;
}
