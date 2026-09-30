import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import { ParsedBatch } from "../../domain/entities/ParsedData";
import { withTimeout } from "../../utils/withTimeout";
import { logger } from "../../utils/logger";
import { describeError } from "../../utils/describeError";

const log = logger.child({ component: "ai" });

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
    const startedAt = Date.now();
    // Wall time across the whole chain, and which provider actually produced
    // the answer. The per-provider lines only see their own call, so a message
    // that burned a 12s timeout before Gemini answered is invisible there.
    const done = (provider: "openai" | "gemini" | "stub") =>
      log.info("parse.chain", {
        provider,
        latencyMs: Date.now() - startedAt,
      });

    try {
      const result = await withTimeout(
        this.primary.parseText(text, ctx),
        PARSE_TIMEOUT_MS,
        "OpenAI parser",
      );
      done("openai");
      return result;
    } catch (error) {
      log.warn("primary parser failed, falling back", {
        provider: "openai",
        fallback: "gemini",
        err: describeError(error),
      });
      try {
        const result = await withTimeout(
          this.secondary.parseText(text, ctx),
          PARSE_TIMEOUT_MS,
          "Gemini parser",
        );
        done("gemini");
        return result;
      } catch (secondaryError) {
        log.error("secondary parser also failed", {
          provider: "gemini",
          err: describeError(secondaryError),
        });
        done("stub");
        // Both failed — return a safe, low-confidence UNKNOWN so the bot can
        // ask the user to try again rather than crashing.
        return {
          transactions: [{ intent: "UNKNOWN", confidence: 0, currency: "INR" }],
        };
      }
    }
  }
}
