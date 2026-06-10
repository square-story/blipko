import { ParseLog } from "@prisma/client";
import { ParsedData } from "../entities/ParsedData";

export interface CreateParseLogDTO {
  rawText: string;
  parsed: ParsedData;
  confidence: number;
  userId?: string | undefined;
}

export interface IParseLogRepository {
  create(data: CreateParseLogDTO): Promise<ParseLog>;
  findById(id: string): Promise<ParseLog | null>;
}
