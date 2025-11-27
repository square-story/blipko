import { GoogleGenAI, Type, Schema } from "@google/genai";
import { IAiParser } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData"; // Assuming this matches the schema below
import { env } from "../../config/env";

// 1. Define the Schema strictly using the SDK types
const transactionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["CREDIT", "DEBIT", "BALANCE"],
      description:
        "CREDIT if user GAVE/SPENT money. DEBIT if user RECEIVED/EARNED money. BALANCE if asking for status.",
    },
    amount: {
      type: Type.NUMBER,
      description:
        "The numeric amount involved. Returns 0 if no amount is mentioned.",
    },
    name: {
      type: Type.STRING,
      description:
        "The name of the person, shop, or entity involved. Returns 'Unknown' if not specified.",
    },
    category: {
      type: Type.STRING,
      description:
        "Inferred category (e.g., Food, Travel, Salary, Loan). Returns 'General' if unclear.",
    },
    currency: {
      type: Type.STRING,
      description: "The currency code detected, defaulting to INR.",
    },
  },
  required: ["intent", "amount", "name"],
};

// 2. The Robust System Prompt for Indian Contexts
const SYSTEM_PROMPT = `
You are an expert AI Financial Parser specialized in Indian transactions. 
Your job is to analyze informal text in English, Hindi, Malayalam, Manglish, or Hinglish and extract structured financial data.

### LINGUISTIC LOGIC (Indian Context):
1. **CREDIT (Money Leaving User):**
   - English: "Gave", "Paid", "Lent", "Spent".
   - Manglish/Malayalam: "Koduthu", "Ayachu", "Chilayi", "Njan koduthu".
   - Hinglish/Hindi: "Diya", "De diya", "Kharch kiya", "Bheja".
   - Example: "Rajuin 500 koduthu" -> { intent: "CREDIT", name: "Raju", amount: 500 }

2. **DEBIT (Money Coming to User):**
   - English: "Got", "Received", "Borrowed from", "Took from".
   - Manglish/Malayalam: "Thannu", "Kitti", "Medichu" (if received), "Vangi" (if received cash).
   - Hinglish/Hindi: "Mila", "Liya", "Aaya".
   - Example: "Raju 500 thannu" (Raju gave me) -> { intent: "DEBIT", name: "Raju", amount: 500 }

3. **BALANCE (Inquiry):**
   - Queries about owing, dues, or status.
   - Example: "How much raju owes?", "Raju balance ethra?", "Hisab kya hai?"

### RULES:
- Identify the *User's* perspective. If I say "Raju paid me", money comes to ME (DEBIT).
- Ignore spelling mistakes.
- If the text is purely conversational without financial intent, default to BALANCE or return 0 amount.
- Always output strict JSON matching the schema.
`;

export class GeminiParser implements IAiParser {
  private client: GoogleGenAI;

  constructor(
    private readonly apiKey: string = env.GEMINI_API_KEY,
    private readonly modelName: string = env.GEMINI_MODEL, // Use a newer model for better JSON adherence
  ) {
    if (!this.apiKey) {
      throw new Error("GeminiParser: API Key is missing.");
    }
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async parseText(text: string): Promise<ParsedData> {
    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: text }],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: transactionSchema,
          temperature: 0.1, // Low temperature for deterministic data extraction
        },
      });

      const responseText = response?.text;
      console.log("GeminiParser Response:", responseText);
      if (!responseText) {
        throw new Error("GeminiParser: Empty response from AI.");
      }

      // The SDK guarantees JSON structure due to responseSchema,
      // but we parse it to ensure it matches our application type.
      const parsed = JSON.parse(responseText) as ParsedData;

      return parsed;
    } catch (error) {
      console.error("GeminiParser Error:", error);

      // Fallback for graceful failure
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
