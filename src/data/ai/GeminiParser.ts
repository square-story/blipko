import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Transaction } from "@prisma/client";
import { IAiParser, ConversationTurn } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData"; // Assuming this matches the schema below
import { env } from "../../config/env";

// 1. Define the Schema strictly using the SDK types
const transactionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        "PAID",
        "RECEIVED",
        "BALANCE",
        "UNDO",
        "VIEW_DAILY_SUMMARY",
        "UPDATE_TRANSACTION",
        "CHAT",
        "QUERY",
        "WALLET",
        "SET_RECURRING",
      ],
      description:
        "PAID if user GAVE/SPENT money. RECEIVED if user GOT/EARNED money. BALANCE if asking for overall status. UNDO if user wants to delete/correct last entry. VIEW_DAILY_SUMMARY if user wants to see today's transactions. UPDATE_TRANSACTION if user wants to modify a previous transaction. CHAT for greetings or general conversation. QUERY if user asks analytics questions about past data, contacts owing money, or spending trends. WALLET if user is managing wallets (list, switch, create, show balance). SET_RECURRING if user wants to set up a recurring income or expense reminder.",
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
    description: {
      type: Type.STRING,
      description:
        "A short description or note about the transaction (e.g., 'Lunch with friends', 'Medical bills', 'Taxi to airport'). Defaults to the category name if no specific detail is found.",
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
    query_details: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: [
            "TOTAL_SPEND",
            "TOTAL_INCOME",
            "NET_BALANCE",
            "TRANSACTION_HISTORY",
            "CONTACT_BALANCE",
            "UNPAID_CONTACTS",
            "OVERDUE_DUES",
            "GROUP_SUMMARY",
            "MEMBER_SPEND",
          ],
          description:
            "CONTACT_BALANCE: asking about a specific person's balance. UNPAID_CONTACTS: who hasn't paid / who owes me. TOTAL_SPEND: how much did I spend. TOTAL_INCOME: how much did I earn.",
        },
        period: {
          type: Type.STRING,
          enum: ["TODAY", "THIS_WEEK", "THIS_MONTH", "ALL_TIME"],
          description: "Time period for the query",
        },
        category: { type: Type.STRING, description: "Category to filter by" },
        contactName: {
          type: Type.STRING,
          description: "Name of the contact for CONTACT_BALANCE queries",
        },
      },
      description: "Structured details when intent is QUERY",
    },
    wallet_action: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["SHOW_BALANCE", "SWITCH", "LIST", "CREATE"],
        },
        walletName: {
          type: Type.STRING,
          description: "Wallet name to switch to or create",
        },
      },
      description: "Structured details when intent is WALLET",
    },
    recurring_details: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "Label for the recurring charge",
        },
        amount: { type: Type.NUMBER, description: "Amount" },
        amountMin: {
          type: Type.NUMBER,
          description: "Minimum amount (for variable charges)",
        },
        amountMax: {
          type: Type.NUMBER,
          description: "Maximum amount (for variable charges)",
        },
        direction: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
        dayOfMonth: {
          type: Type.NUMBER,
          description: "Day of month the charge is due (1-31)",
        },
        period: { type: Type.STRING, enum: ["MONTHLY", "QUARTERLY"] },
        walletName: {
          type: Type.STRING,
          description: "Wallet to charge against",
        },
      },
      description: "Structured details when intent is SET_RECURRING",
    },
  },
  required: ["intent", "amount", "name"],
};

// 2. The Robust System Prompt for Indian Contexts
const SYSTEM_PROMPT = `
You are an expert AI Financial Parser specialized in Indian transactions. 
Your job is to analyze informal text in English, Hindi, Malayalam, Manglish, or Hinglish and extract structured financial data.

### LINGUISTIC LOGIC (Indian Context):
1. **PAID (Money Leaving User — you spent/gave):**
   - English: "Gave", "Paid", "Lent", "Spent".
   - Manglish/Malayalam: "Koduthu", "Ayachu", "Chilayi", "Njan koduthu".
   - Hinglish/Hindi: "Diya", "De diya", "Kharch kiya", "Bheja".
   - Example: "Rajuin 500 koduthu" -> { intent: "PAID", name: "Raju", amount: 500, description: "Payment to Raju", category: "General" }

2. **RECEIVED (Money Coming to User — you got/earned):**
   - English: "Got", "Received", "Borrowed from", "Took from".
   - Manglish/Malayalam: "Thannu", "Kitti", "Medichu" (if received), "Vangi" (if received cash).
   - Hinglish/Hindi: "Mila", "Liya", "Aaya".
   - Example: "Raju 500 thannu" (Raju gave me) -> { intent: "RECEIVED", name: "Raju", amount: 500 }

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
   - Example: "Actually it was 600" -> { intent: "UPDATE_TRANSACTION", updatedFields: { amount: 600 } }

7. **CHAT (Conversational):**
   - Greetings, thanks, or general feedback that isn't a transaction.
   - Example INPUT: "Hi", "Good morning", "Thanks bot".
   - Example OUTPUT: { intent: "CHAT", conversational_response: "Hello! How can I help you tracking your expenses today?" }
   - Example INPUT: "What tech stack are you enabled with?"
   - Example OUTPUT: { intent: "CHAT", conversational_response: "I am running on Node.js using Gemini for parsing." }

8. **QUERY (Analytics/Questions):**
   - Asking about past data, totals, trends, or contact balances.
   - Example: "How much did I spend on food this month?" → { intent: "QUERY", query_details: { type: "TOTAL_SPEND", category: "Food", period: "THIS_MONTH" } }
   - Example: "Who hasn't paid this month?" / "Aarike paisa thannilla?" → { intent: "QUERY", query_details: { type: "UNPAID_CONTACTS", period: "THIS_MONTH" } }
   - Example: "What's Raju's balance?" / "Raju ethra tharam?" → { intent: "QUERY", query_details: { type: "CONTACT_BALANCE", contactName: "Raju" } }
   - Example: "Who is overdue?" / "Baaki aarike undu?" → { intent: "QUERY", query_details: { type: "UNPAID_CONTACTS" } }
   - Example: "family summary" / "sabka kitna hua" → { intent: "QUERY", query_details: { type: "GROUP_SUMMARY" } }
   - Example: "show Priya's spending" / "Priya ne kitna kharch kiya" → { intent: "QUERY", query_details: { type: "MEMBER_SPEND", contactName: "Priya" } }

9. **WALLET (Wallet management):**
   - Example: "show wallets" / "list my wallets" → { intent: "WALLET", wallet_action: { action: "LIST" } }
   - Example: "switch to Shop" / "use my business wallet" → { intent: "WALLET", wallet_action: { action: "SWITCH", walletName: "Shop" } }
   - Example: "create savings wallet" → { intent: "WALLET", wallet_action: { action: "CREATE", walletName: "Savings" } }
   - Example: "show shop balance" → { intent: "WALLET", wallet_action: { action: "SHOW_BALANCE", walletName: "Shop" } }

10. **SET_RECURRING (Recurring reminders):**
    - Example: "remind me rent 8000 on 1st every month" → { intent: "SET_RECURRING", recurring_details: { description: "Rent", amount: 8000, direction: "EXPENSE", dayOfMonth: 1, period: "MONTHLY" } }
    - Example: "salary 30000 on 25th monthly" → { intent: "SET_RECURRING", recurring_details: { description: "Salary", amount: 30000, direction: "INCOME", dayOfMonth: 25, period: "MONTHLY" } }
    - Example: "around 500 electricity on 15th monthly" → { intent: "SET_RECURRING", recurring_details: { description: "Electricity", amount: 500, amountMin: 400, amountMax: 700, direction: "EXPENSE", dayOfMonth: 15, period: "MONTHLY" } }

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

  async parseText(
    text: string,
    replyTransaction?: Transaction | null,
    history: ConversationTurn[] = [],
  ): Promise<ParsedData> {
    try {
      let promptText = text;
      if (replyTransaction) {
        promptText = `Context: User is replying to a message/transaction.
Transaction Details: ${JSON.stringify(replyTransaction)}
User Reply: "${text}"
Analyze the reply based on the context. If they are correcting something, use UPDATE_TRANSACTION.`;
      }

      const historyContents = history.map((h) => ({
        role: h.role,
        parts: [{ text: h.content }],
      }));

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          ...historyContents,
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
