import { ParseLog } from "@prisma/client";
import { ParsedData } from "../entities/ParsedData";

export interface CreateParseLogDTO {
  rawText: string;
  // Usually a ParsedData, but also serves as the pending-action staging store
  // (e.g. a staged transaction edit), so any JSON-serializable object is allowed.
  parsed: ParsedData | Record<string, unknown>;
  confidence: number;
  userId?: string | undefined;
  batchId?: string | undefined;
}

export interface IParseLogRepository {
  create(data: CreateParseLogDTO): Promise<ParseLog>;
  findById(id: string): Promise<ParseLog | null>;
}
