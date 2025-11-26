import { ParsedData } from '../entities/ParsedData';

export interface IAiParser {
  parseText(text: string): Promise<ParsedData>;
}

