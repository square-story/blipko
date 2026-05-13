import { prisma } from "../prisma/client";
import {
  IConversationRepository,
  ConversationTurn,
} from "../../domain/repositories/IConversationRepository";

export class PrismaConversationRepository implements IConversationRepository {
  async getRecent(userId: string, limit: number): Promise<ConversationTurn[]> {
    const rows = await prisma.conversationMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true, createdAt: true },
    });
    return rows.reverse();
  }

  async append(
    userId: string,
    role: "user" | "model",
    content: string,
  ): Promise<void> {
    await prisma.conversationMessage.create({
      data: { userId, role, content },
    });
  }
}
