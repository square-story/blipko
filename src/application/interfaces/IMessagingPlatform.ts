export interface SendMessagePayload {
  to: string; // platformUserId
  body: string; // plain text or Markdown
}

export interface InlineButton {
  id: string; // callback_data sent back on press
  title: string; // display text
}

export interface IMessagingPlatform {
  sendMessage(payload: SendMessagePayload): Promise<string>;
  sendTypingIndicator(platformUserId: string): Promise<void>;
  sendInteractiveMessage(
    to: string,
    body: string,
    buttons: InlineButton[],
  ): Promise<string>;
  // Optional: ack a button press (Telegram: answerCallbackQuery)
  acknowledgeInteraction?(interactionId: string): Promise<void>;
}
