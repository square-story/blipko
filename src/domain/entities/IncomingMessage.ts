export interface IncomingMessage {
  platformUserId: string; // Telegram: chat_id as string
  platformUsername?: string; // Telegram: @username or first_name
  messageId: string; // for dedup (ProcessedMessage) and typing indicators
  text?: string;
  audioFileId?: string; // platform-specific file ID for voice/audio
  audioMimeType?: string;
  replyToMessageId?: string;
  buttonReply?: {
    id: string; // callback_data
    title: string;
    interactionId?: string; // Telegram: callback_query.id — needed for answerCallbackQuery
  };
}
