import { ParsedData } from "../entities/ParsedData";

export interface IAiParser {
  parseText(text: string, context?: any): Promise<ParsedData>;
}
