import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData";

// Chains two parsers: primary (OpenAI) → secondary (Gemini) → safe stub.
// Either parser throws on a provider error or a Zod validation failure, so one
// outage or a malformed response never takes the product down.
export class FallbackAiParser implements IAiParser {
  constructor(
    private readonly primary: IAiParser,
    private readonly secondary: IAiParser,
  ) {}

  async parseText(text: string, ctx: ParseContext): Promise<ParsedData> {
    try {
      return await this.primary.parseText(text, ctx);
    } catch (error) {
      console.warn(
        "Primary AI parser (OpenAI) failed. Falling back to secondary (Gemini).",
        error,
      );
      try {
        return await this.secondary.parseText(text, ctx);
      } catch (secondaryError) {
        console.error(
          "Secondary AI parser (Gemini) also failed.",
          secondaryError,
        );
        // Both failed — return a safe, low-confidence UNKNOWN so the bot can
        // ask the user to try again rather than crashing.
        return { intent: "UNKNOWN", confidence: 0, currency: "INR" };
      }
    }
  }
}
