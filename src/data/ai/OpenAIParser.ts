import OpenAI from "openai";
import { IAiParser } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData";
import { env } from "../../config/env";

const SYSTEM_PROMPT = `
You are an expert AI Financial Parser specialized in Indian transactions. 
Your job is to analyze informal text in English, Hindi, Malayalam, Manglish, or Hinglish and extract structured financial data.

### LINGUISTIC LOGIC (Indian Context):
1. **CREDIT (Money Leaving User):**
   - English: "Gave", "Paid", "Lent", "Spent".
   - Manglish/Malayalam: "Koduthu", "Ayachu", "Chilayi", "Njan koduthu".
   - Hinglish/Hindi: "Diya", "De diya", "Kharch kiya", "Bheja".
   - Example: "Rajuin 500 koduthu" -> { intent: "CREDIT", name: "Raju", amount: 500, description: "Payment to Raju", category: "General" }

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
   - Example: "Delete last entry" -> { intent: "UNDO", name: "Unknown", amount: 0 }

5. **VIEW_DAILY_SUMMARY (Report):**
   - requests to see today's spending or entries.
   - Example: "Show me today's spend" -> { intent: "VIEW_DAILY_SUMMARY", name: "Unknown", amount: 0 }

6. **UPDATE_TRANSACTION (Modification):**
   - User replies to a transaction confirmation to change details.
   - Example: "Actually it was 600" -> { intent: "UPDATE_TRANSACTION", updatedFields: { amount: 600 } }

7. **CHAT (Conversational):**
   - Greetings, thanks, or general feedback that isn't a transaction.
   - Example INPUT: "Hi", "Good morning", "Thanks bot".
   - Example OUTPUT: { intent: "CHAT", conversational_response: "Hello! How can I help you tracking your expenses today?" }
   - Example INPUT: "What tech stack are you enabled with?"
   - Example OUTPUT: { intent: "CHAT", conversational_response: "I am running on Node.js using OpenAI for parsing." }

8. **QUERY (Analytics/Questions):**
   - Asking about past data, totals, or trends.
   - Example: "How much did I spend on food this month?"
   - Output: { intent: "QUERY", query_details: { type: "TOTAL_SPEND", category: "Food", period: "THIS_MONTH" } }

### RULES:
- Identify the *User's* perspective. If I say "Raju paid me", money comes to ME (DEBIT).
- Ignore spelling mistakes.
- If the text is purely conversational, use CHAT. **CRITICAL**: Generate a relevant, helpful, and natural 'conversational_response' based SPECIFICALLY on the user's input. Do NOT use the example greeting unless the user actually said "Hi".
- If the text is asking for data/analytics, use QUERY.
- **IMPORTANT**: Extract a 'description' field separately from 'category'. 
  - 'description': What happened (e.g. "Taxi to airport").
  - 'category': Classification (e.g. "Travel").
- Always output strict JSON.
`;

export class OpenAIParser implements IAiParser {
  private client: OpenAI;

  constructor(private readonly apiKey: string = env.OPENAI_API_KEY) {
    if (!this.apiKey) {
      throw new Error("OpenAIParser: API Key is missing.");
    }
    this.client = new OpenAI({ apiKey: this.apiKey });
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

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective and fast
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: promptText },
        ],
        response_format: { type: "json_object" }, // Enforce valid JSON
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content ?? "";
      console.log("OpenAIParser Response:", responseText);

      if (!responseText) {
        throw new Error("OpenAIParser: Empty response from AI.");
      }

      return JSON.parse(responseText) as ParsedData;
    } catch (error) {
      console.error("OpenAIParser Error:", error);
      throw error; // Re-throw to let fallback handle it
    }
  }
}
