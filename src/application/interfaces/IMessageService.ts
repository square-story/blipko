export interface SendMessagePayload {
  to: string;
  body: string;
}

export interface IMessageService {
  sendMessage(payload: SendMessagePayload): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
  sendTypingIndicator(messageId: string): Promise<void>;
}
