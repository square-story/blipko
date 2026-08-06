import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import { ParsedBatch } from "../../domain/entities/ParsedData";
import { withTimeout } from "../../utils/withTimeout";
import { logger } from "../../utils/logger";

const log = logger.child({ component: "ai" });

// The logger JSON-stringifies its fields, and an Error serializes to `{}` —
// which would hide the very Zod message that says what the provider got wrong.
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

  async parseText(text: string, ctx: ParseContext): Promise<ParsedBatch> {
    try {
      return await withTimeout(
        this.primary.parseText(text, ctx),
        PARSE_TIMEOUT_MS,
        "OpenAI parser",
      );
    } catch (error) {
      log.warn("primary parser failed, falling back", {
        provider: "openai",
        fallback: "gemini",
        err: describeError(error),
      });
      try {
        return await withTimeout(
          this.secondary.parseText(text, ctx),
          PARSE_TIMEOUT_MS,
          "Gemini parser",
        );
      } catch (secondaryError) {
        log.error("secondary parser also failed", {
          provider: "gemini",
          err: describeError(secondaryError),
        });
        // Both failed — return a safe, low-confidence UNKNOWN so the bot can
        // ask the user to try again rather than crashing.
        return {
          transactions: [{ intent: "UNKNOWN", confidence: 0, currency: "INR" }],
        };
      }
    }
  }
}
