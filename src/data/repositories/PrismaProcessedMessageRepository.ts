import { PrismaClient } from "@prisma/client";
import { IProcessedMessageRepository } from "../../domain/repositories/IProcessedMessageRepository";

export class PrismaProcessedMessageRepository implements IProcessedMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(messageId: string): Promise<boolean> {
    // Atomic insert-or-ignore on the unique messageId: race-safe like a bare
    // create(), but never raises P2002 — so a normal duplicate delivery doesn't
    // emit a (misleading) prisma:error log line.
    const { count } = await this.prisma.processedMessage.createMany({
      data: [{ messageId }],
      skipDuplicates: true,
    });
    return count > 0; // true = first delivery (claimed); false = duplicate
  }
}
