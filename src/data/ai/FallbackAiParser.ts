import { IAiParser } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData";

export class FallbackAiParser implements IAiParser {
  constructor(
    private readonly primary: IAiParser,
    private readonly secondary: IAiParser,
  ) {}

  async parseText(text: string, context?: any): Promise<ParsedData> {
    try {
      // Try primary parser (OpenAI)
      return await this.primary.parseText(text, context);
    } catch (error) {
      console.warn(
        "Primary AI Parser (OpenAI) failed. Falling back to Secondary (Gemini).",
        error,
      );

      try {
        // Fallback to secondary parser (Gemini)
        return await this.secondary.parseText(text, context);
      } catch (secondaryError) {
        console.error(
          "Secondary AI Parser (Gemini) also failed.",
          secondaryError,
        );

        // Final fallback to graceful error object if both fail
        return {
          intent: "BALANCE",
          amount: 0,
          name: "Unknown",
          category: "Error",
          currency: "INR",
        } as ParsedData;
      }
    }
  }
}
