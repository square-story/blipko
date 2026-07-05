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

export interface SendInteractiveOptions {
  // Thread this message as a reply under an existing message (Telegram:
  // reply_to_message_id) — e.g. an "Are you sure?" prompt under a transaction.
  replyToMessageId?: string | undefined;
}

export interface IMessagingPlatform {
  sendMessage(payload: SendMessagePayload): Promise<string>;
  sendTypingIndicator(platformUserId: string): Promise<void>;
  sendInteractiveMessage(
    to: string,
    body: string,
    rows: InlineButtonRows,
    opts?: SendInteractiveOptions,
  ): Promise<string>;
  // Edit an existing message's text + keyboard in place (for multi-select
  // toggles and in-place confirm resolution — pass rows: [] to clear buttons).
  editInteractiveMessage?(
    to: string,
    messageId: string,
    body: string,
    rows: InlineButtonRows,
  ): Promise<void>;
  // Optional: ack a button press (Telegram: answerCallbackQuery). An optional
  // `text` shows a small toast on the tapped button.
  acknowledgeInteraction?(interactionId: string, text?: string): Promise<void>;
}
