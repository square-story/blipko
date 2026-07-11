import { GoogleGenAI, Type, Schema } from "@google/genai";
import { IAiParser, ParseContext } from "../../domain/services/IAiParser";
import {
  ParsedBatch,
  ParsedBatchSchema,
} from "../../domain/entities/ParsedData";
import { buildBudgetSystemPrompt } from "./budgetParserPrompt";
import { env } from "../../config/env";

// Per-transaction structured-output schema enforced by Gemini.
const transactionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        "EXPENSE",
        "INCOME",
        "UNDO",
        "STATUS",
        "RECURRING",
        "QUERY",
        "BOX",
        "UNKNOWN",
      ],
      description:
        'EXPENSE if the user spent money. INCOME if they received money/declared salary. STATUS for a plain overall budget-health check ("status", "how much is left"). UNDO to remove the last entry. RECURRING to set up a repeating monthly income/expense ("every month", "monthly", "on the Nth"). QUERY when the user ASKS a data-backed question about their spending/income/budget ("how much did I spend on food?", "biggest expense?", "can I afford X?", trends/comparisons) — a question, never a statement that logs money. BOX to add money to / withdraw from a NAMED savings goal or fund ("add 5000 to New York", "take 2000 from house fund") — only with explicit box phrasing, never ordinary spending. UNKNOWN for social/non-financial messages.',
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
    dayOfMonth: {
      type: Type.NUMBER,
      description: "RECURRING only: day of month (1-28) it repeats.",
    },
    recurringKind: {
      type: Type.STRING,
      enum: ["INCOME", "EXPENSE"],
      description:
        "RECURRING only: whether the repeating item is income or expense.",
    },
    boxName: {
      type: Type.STRING,
      description:
        "BOX only: the savings goal / fund the money moves in/out of.",
    },
    boxDirection: {
      type: Type.STRING,
      enum: ["IN", "OUT"],
      description: "BOX only: IN to add money to the box, OUT to withdraw.",
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

// The envelope: one message → one or more transactions.
const budgetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      items: transactionSchema,
      description:
        "One entry per transaction. A single spend is an array of one; only genuine multi-transaction dumps have more.",
    },
  },
  required: ["transactions"],
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

  async parseText(text: string, ctx: ParseContext): Promise<ParsedBatch> {
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
    return ParsedBatchSchema.parse(JSON.parse(responseText));
  }
}
