import { ParseLog, PrismaClient, Prisma } from "@prisma/client";
import {
  CreateParseLogDTO,
  IParseLogRepository,
} from "../../domain/repositories/IParseLogRepository";

export class PrismaParseLogRepository implements IParseLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateParseLogDTO): Promise<ParseLog> {
    return this.prisma.parseLog.create({
      data: {
        rawText: data.rawText,
        parsed: data.parsed as unknown as Prisma.InputJsonValue,
        confidence: data.confidence,
        userId: data.userId ?? null,
        batchId: data.batchId ?? null,
      },
    });
  }

  async findById(id: string): Promise<ParseLog | null> {
    return this.prisma.parseLog.findUnique({ where: { id } });
  }
}
