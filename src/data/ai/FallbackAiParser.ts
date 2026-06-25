import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData";
import { withTimeout } from "../../utils/withTimeout";

// A slow/hung provider call must not block the webhook indefinitely.
const PARSE_TIMEOUT_MS = 12_000;

// Chains two parsers: primary (OpenAI) → secondary (Gemini) → safe stub.
// Either parser throws on a provider error, timeout, or a Zod validation
// failure, so one outage or a malformed response never takes the product down.
export class FallbackAiParser implements IAiParser {
  constructor(
    private readonly primary: IAiParser,
    private readonly secondary: IAiParser,
  ) {}

  async parseText(text: string, ctx: ParseContext): Promise<ParsedData> {
    try {
      return await withTimeout(
        this.primary.parseText(text, ctx),
        PARSE_TIMEOUT_MS,
        "OpenAI parser",
      );
    } catch (error) {
      console.warn(
        "Primary AI parser (OpenAI) failed. Falling back to secondary (Gemini).",
        error,
      );
      try {
        return await withTimeout(
          this.secondary.parseText(text, ctx),
          PARSE_TIMEOUT_MS,
          "Gemini parser",
        );
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
