import OpenAI from "openai";
import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import {
  ParsedBatch,
  ParsedBatchSchema,
} from "../../domain/entities/ParsedData";
import { buildBudgetSystemPrompt } from "./budgetParserPrompt";
import { env } from "../../config/env";

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

    const historyMessages = (ctx.history ?? []).map((h) => ({
      role: (h.role === "model" ? "assistant" : h.role) as "user" | "assistant",
      content: h.content,
    }));

    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildBudgetSystemPrompt(ctx.categories) },
        ...historyMessages,
        { role: "user", content: promptText },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const responseText = completion.choices[0]?.message?.content ?? "";
    console.log("OpenAIParser Response:", responseText);
    if (!responseText) {
      throw new Error("OpenAIParser: Empty response from AI.");
    }

    // Validate with Zod — a throw here lets the fallback parser take over.
    return ParsedBatchSchema.parse(JSON.parse(responseText));
  }
}
