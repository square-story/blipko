export interface ConversationTurn {
  role: string;
  content: string;
  createdAt: Date;
}

export interface IConversationRepository {
  getRecent(userId: string, limit: number): Promise<ConversationTurn[]>;
  append(
    userId: string,
    role: "user" | "model",
    content: string,
  ): Promise<void>;
}
