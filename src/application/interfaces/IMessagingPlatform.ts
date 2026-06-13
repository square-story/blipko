export interface SendMessagePayload {
  to: string; // platformUserId
  body: string; // plain text or Markdown
}

export interface InlineButton {
  id: string; // callback_data sent back on press
  title: string; // display text
}

// Inline buttons are laid out as rows: InlineButton[][] (each inner array is one
// row). A single-row keyboard is just [[...]].
export type InlineButtonRows = InlineButton[][];

export interface IMessagingPlatform {
  sendMessage(payload: SendMessagePayload): Promise<string>;
  sendTypingIndicator(platformUserId: string): Promise<void>;
  sendInteractiveMessage(
    to: string,
    body: string,
    rows: InlineButtonRows,
  ): Promise<string>;
  // Edit an existing message's text + keyboard in place (for multi-select
  // toggles). No-op if the platform can't edit.
  editInteractiveMessage?(
    to: string,
    messageId: string,
    body: string,
    rows: InlineButtonRows,
  ): Promise<void>;
  // Optional: ack a button press (Telegram: answerCallbackQuery)
  acknowledgeInteraction?(interactionId: string): Promise<void>;
}
