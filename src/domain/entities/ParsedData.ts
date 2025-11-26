export type ParsedIntent = 'CREDIT' | 'DEBIT' | 'BALANCE';

export interface ParsedData {
  intent: ParsedIntent;
  amount?: number;
  name?: string;
  notes?: string;
}

