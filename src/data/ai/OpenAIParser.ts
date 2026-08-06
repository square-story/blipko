import OpenAI from "openai";
import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import {
  ParsedBatch,
  ParsedBatchSchema,
} from "../../domain/entities/ParsedData";
import { buildBudgetSystemPrompt } from "./budgetParserPrompt";
import { openaiBudgetSchema, stripNulls } from "./openaiBudgetSchema";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

const log = logger.child({ component: "ai", provider: "openai" });

export class OpenAIParser implements IAiParser {
  private client: OpenAI;

  constructor(private readonly apiKey: string = env.OPENAI_API_KEY) {
    if (!this.apiKey) {
      throw new Error("OpenAIParser: API Key is missing.");
    }
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async parseText(text: string, ctx: ParseContext): Promise<ParsedBatch> {
    const today = new Date().toISOString().split("T")[0];
    const promptText = `[Today: ${today}]\n${text}`;

    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      // History lives inside the system prompt as a bounded data block, not as
      // real assistant turns — see historyBlock.ts.
      messages: [
        {
          role: "system",
          content: buildBudgetSystemPrompt(ctx.categories, ctx.history),
        },
        { role: "user", content: promptText },
      ],
      // Strict json_schema, not json_object: json_object only guarantees valid
      // JSON *syntax*, which let the model drop the `transactions` envelope and
      // return a bare transaction object.
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "budget_batch",
          strict: true,
          schema: openaiBudgetSchema,
        },
      },
      temperature: 0.1,
    });

    const responseText = completion.choices[0]?.message?.content ?? "";
    log.debug("parser response", { responseText });
    if (!responseText) {
      throw new Error("OpenAIParser: Empty response from AI.");
    }

    // Validate with Zod — a throw here lets the fallback parser take over.
    return ParsedBatchSchema.parse(stripNulls(JSON.parse(responseText)));
  }
}
