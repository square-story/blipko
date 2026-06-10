import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  IAiParser,
  ParseContext,
} from "../../domain/services/IAiParser";
import { ParsedData, ParsedDataSchema } from "../../domain/entities/ParsedData";
import { buildBudgetSystemPrompt } from "./budgetParserPrompt";
import { env } from "../../config/env";

// Structured-output schema enforced by Gemini (responseSchema).
const budgetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["EXPENSE", "INCOME", "UNDO", "STATUS", "UNKNOWN"],
      description:
        "EXPENSE if the user spent money. INCOME if they received money/declared salary. STATUS for budget-health questions. UNDO to remove the last entry. UNKNOWN for social/non-financial messages.",
    },
    amount: {
      type: Type.NUMBER,
      description: "The numeric amount. 0 if none mentioned.",
    },
    currency: { type: Type.STRING, description: "Currency code, default INR." },
    category: {
      type: Type.STRING,
      description: "Best category — prefer one from the user's list.",
    },
    bucket: {
      type: Type.STRING,
      enum: ["NEEDS", "WANTS", "SAVINGS"],
      description: "The 50/30/20 bucket this spend belongs to.",
    },
    note: {
      type: Type.STRING,
      description: "Short free-text note (e.g. 'lunch', 'auto to office').",
    },
    confidence: {
      type: Type.NUMBER,
      description:
        "0..1 confidence in amount + category + bucket. Below 0.6 when ambiguous.",
    },
    conversational_response: {
      type: Type.STRING,
      description: "Friendly reply, only for UNKNOWN/social messages.",
    },
  },
  required: ["intent", "confidence"],
};

export class GeminiParser implements IAiParser {
  private client: GoogleGenAI;

  constructor(
    private readonly apiKey: string = env.GEMINI_API_KEY,
    private readonly modelName: string = env.GEMINI_MODEL,
  ) {
    if (!this.apiKey) {
      throw new Error("GeminiParser: API Key is missing.");
    }
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async parseText(text: string, ctx: ParseContext): Promise<ParsedData> {
    const today = new Date().toISOString().split("T")[0];
    const promptText = `[Today: ${today}]\n${text}`;

    const historyContents = (ctx.history ?? []).map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

    const response = await this.client.models.generateContent({
      model: this.modelName,
      contents: [
        ...historyContents,
        { role: "user", parts: [{ text: promptText }] },
      ],
      config: {
        systemInstruction: buildBudgetSystemPrompt(ctx.categories),
        responseMimeType: "application/json",
        responseSchema: budgetSchema,
        temperature: 0.1,
      },
    });

    const responseText = response?.text;
    console.log("GeminiParser Response:", responseText);
    if (!responseText) {
      throw new Error("GeminiParser: Empty response from AI.");
    }

    // Validate with Zod — a throw here cascades to the fallback chain.
    return ParsedDataSchema.parse(JSON.parse(responseText));
  }
}
