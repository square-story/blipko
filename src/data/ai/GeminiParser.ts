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
      enum: [
        "CREDIT",
        "DEBIT",
        "BALANCE",
        "UNDO",
        "VIEW_DAILY_SUMMARY",
        "UPDATE_TRANSACTION",
      ],
      description:
        "CREDIT if user GAVE/SPENT money. DEBIT if user RECEIVED/EARNED money. BALANCE if asking for status. UNDO if user wants to delete/correct last entry. VIEW_DAILY_SUMMARY if user wants to see today's transactions. UPDATE_TRANSACTION if user wants to modify a previous transaction (e.g. change amount, category).",
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
    updatedFields: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "New amount if updated" },
        category: { type: Type.STRING, description: "New category if updated" },
        description: {
          type: Type.STRING,
          description: "New description if updated",
        },
        name: { type: Type.STRING, description: "New name if updated" },
      },
      description: "Fields to update if intent is UPDATE_TRANSACTION",
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

4. **UNDO (Correction/Deletion):**
   - Requests to undo, delete, or correct the last action.
   - English: "Undo", "Delete last", "Mistake", "Remove".
   - Manglish/Malayalam: "Maati", "Thettu patti", "Kalayuka", "Thirichu".
   - Hinglish/Hindi: "Galti se add ho gaya", "Wapas karo", "Delete karo", "Hata do".
   - Example: "Delete last entry" -> { intent: "UNDO", name: "Unknown", amount: 0 }

5. **VIEW_DAILY_SUMMARY (Report):**
   - Requests to see today's spending or entries.
   - English: "Today's spend", "Daily summary", "Show today's entries".
   - Manglish/Malayalam: "Innathe chilavu", "Innathe kanakku".
   - Hinglish/Hindi: "Aaj ka kharcha", "Aaj ka hisab".
   - Example: "Show me today's spend" -> { intent: "VIEW_DAILY_SUMMARY", name: "Unknown", amount: 0 }

6. **UPDATE_TRANSACTION (Modification):**
   - User replies to a transaction confirmation to change details.
   - Context will be provided.
   - Example: "Actually it was 600" -> { intent: "UPDATE_TRANSACTION", updatedFields: { amount: 600 } }
   - Example: "Change category to Food" -> { intent: "UPDATE_TRANSACTION", updatedFields: { category: "Food" } }

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

  async parseText(text: string, context?: any): Promise<ParsedData> {
    try {
      let promptText = text;
      if (context) {
        promptText = `Context: User is replying to a message/transaction. 
Transaction Details: ${JSON.stringify(context)}
User Reply: "${text}"
Analyze the reply based on the context. If they are correcting something, use UPDATE_TRANSACTION.`;
      }

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
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
