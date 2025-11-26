import { IAiParser } from '../../domain/services/IAiParser';
import { ParsedData } from '../../domain/entities/ParsedData';
import { env } from '../../config/env';

const SYSTEM_PROMPT =
  "You are a financial parsing assistant. Analyze the user text. Return ONLY JSON. If user gave money (Credit), intent is 'CREDIT'. If user received money (Debit), intent is 'DEBIT'. If asking for owed money, intent is 'BALANCE'. Example input: 'Gave 500 to Raju', Output: {'intent': 'CREDIT', 'amount': 500, 'name': 'Raju'}.";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class GeminiParser implements IAiParser {
  constructor(
    private readonly apiKey: string = env.GEMINI_API_KEY,
    private readonly model: string = env.GEMINI_MODEL,
  ) {}

  async parseText(text: string): Promise<ParsedData> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`GeminiParser::parseText failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    const raw =
      payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      '{"intent":"BALANCE"}';

    try {
      const parsed = JSON.parse(raw) as ParsedData;
      return parsed;
    } catch (error) {
      throw new Error('GeminiParser::parseText returned invalid JSON');
    }
  }
}


