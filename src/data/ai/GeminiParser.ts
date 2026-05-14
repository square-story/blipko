import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Transaction } from "@prisma/client";
import { IAiParser, ConversationTurn } from "../../domain/services/IAiParser";
import { ParsedData } from "../../domain/entities/ParsedData";
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
        "GROUP_SETUP",
      ],
      description:
        "PAID if user GAVE/SPENT money. RECEIVED if user GOT/EARNED money. BALANCE if asking for overall status. UNDO if user wants to delete/correct last entry. VIEW_DAILY_SUMMARY if user wants to see today's transactions. UPDATE_TRANSACTION if user wants to modify a previous transaction. CHAT for greetings or general NON-FINANCIAL conversation only. QUERY if user asks anything about their money, spending, income, balances, or contacts. WALLET if user is managing wallets. SET_RECURRING if user wants to set up a recurring income or expense reminder. GROUP_SETUP if user wants to create a family/group or join one.",
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
    participants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Contact name" },
          amount: { type: Type.NUMBER, description: "Amount for this person" },
        },
        required: ["name", "amount"],
      },
      description:
        "Populated when multiple people are involved in one message. Leave empty for single-person transactions.",
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
            "CONTACT_BALANCE: asking about a specific person's balance. UNPAID_CONTACTS: who hasn't paid / who owes me. TOTAL_SPEND: how much did I spend. TOTAL_INCOME: how much did I earn. NET_BALANCE: overall net position.",
        },
        from_date: {
          type: Type.STRING,
          description:
            "Start date in YYYY-MM-DD format. Calculate from the user's natural language (e.g. 'last 3 months' → 90 days before today). Leave empty for all-time queries.",
        },
        to_date: {
          type: Type.STRING,
          description:
            "End date in YYYY-MM-DD format. Usually today unless the user specifies otherwise.",
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
    group_action: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["CREATE", "JOIN"],
          description: "CREATE a new family group or JOIN an existing one",
        },
        code: {
          type: Type.STRING,
          description: "Invite code if the user is joining a group",
        },
      },
      description: "Structured details when intent is GROUP_SETUP",
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

   MULTI-PERSON: When multiple people are involved in the same transaction direction:
   - "Samsul and Faisal paid me 300 each" → { intent: "RECEIVED", amount: 300, name: "Samsul", participants: [{ name: "Samsul", amount: 300 }, { name: "Faisal", amount: 300 }] }
   - "Paid 500 to Raju and 200 to Priya" → { intent: "PAID", amount: 500, name: "Raju", participants: [{ name: "Raju", amount: 500 }, { name: "Priya", amount: 200 }] }
   - "Samsul 200, Faisal 300, David 150 koduthu" → { intent: "PAID", participants: [{ name: "Samsul", amount: 200 }, { name: "Faisal", amount: 300 }, { name: "David", amount: 150 }] }
   Only populate participants when >1 person. For single-person, leave participants empty.

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

7. **CHAT (Conversational — NON-FINANCIAL ONLY):**
   - ONLY for purely social messages: greetings, thanks, jokes, tech questions, compliments.
   - Example INPUT: "Hi", "Good morning", "Thanks bot".
   - Example OUTPUT: { intent: "CHAT", conversational_response: "Hello! How can I help you tracking your expenses today?" }
   - Example INPUT: "What tech stack are you enabled with?"
   - Example OUTPUT: { intent: "CHAT", conversational_response: "I am running on Node.js using Gemini for parsing." }

8. **QUERY (Analytics/Financial Questions — USE FOR ALL MONEY QUESTIONS):**
   - ANY question about money, spending, income, balances, transactions, or contacts → ALWAYS QUERY.
   - Use from_date and to_date (YYYY-MM-DD) calculated from today's date for time-based queries.
   - Example: "How much did I spend on food this month?" → { intent: "QUERY", query_details: { type: "TOTAL_SPEND", category: "Food", from_date: "[first day of current month]", to_date: "[today]" } }
   - Example: "expenses in the last 3 months" / "pichle teen mahine ka kharcha" → { intent: "QUERY", query_details: { type: "TOTAL_SPEND", from_date: "[90 days ago]", to_date: "[today]" } }
   - Example: "how much did I earn this year" → { intent: "QUERY", query_details: { type: "TOTAL_INCOME", from_date: "[Jan 1 of current year]", to_date: "[today]" } }
   - Example: "last year total spend" → { intent: "QUERY", query_details: { type: "TOTAL_SPEND", from_date: "[Jan 1 last year]", to_date: "[Dec 31 last year]" } }
   - Example: "Who hasn't paid this month?" / "Aarike paisa thannilla?" → { intent: "QUERY", query_details: { type: "UNPAID_CONTACTS" } }
   - Example: "What's Raju's balance?" / "Raju ethra tharam?" → { intent: "QUERY", query_details: { type: "CONTACT_BALANCE", contactName: "Raju" } }
   - Example: "family summary" / "show group spending" / "sabka kitna hua" / "family ka hisab" → { intent: "QUERY", query_details: { type: "GROUP_SUMMARY" } }
   - Example: "how much did Raju spend this month?" (in a group) → { intent: "QUERY", query_details: { type: "MEMBER_SPEND", contactName: "Raju" } }
   - Example: "show my group spending" / "mera group spend" → { intent: "QUERY", query_details: { type: "MEMBER_SPEND" } }
   - Casual financial queries also use QUERY: "Bhai kitna kharch hua?" → { intent: "QUERY", query_details: { type: "TOTAL_SPEND", from_date: "[first day of current month]", to_date: "[today]" } }
   - "Paise ka hisab dikhao" → { intent: "QUERY", query_details: { type: "NET_BALANCE" } }

9. **WALLET (Wallet management):**
   - Example: "show wallets" / "list my wallets" → { intent: "WALLET", wallet_action: { action: "LIST" } }
   - Example: "switch to Shop" / "use my business wallet" → { intent: "WALLET", wallet_action: { action: "SWITCH", walletName: "Shop" } }
   - Example: "create savings wallet" → { intent: "WALLET", wallet_action: { action: "CREATE", walletName: "Savings" } }
   - Example: "show shop balance" → { intent: "WALLET", wallet_action: { action: "SHOW_BALANCE", walletName: "Shop" } }
   - NOTE: "Shop: paid 500 for supplies" uses wallet prefix syntax — this is PAID intent, not WALLET.

10. **SET_RECURRING (Recurring reminders):**
    - Example: "remind me rent 8000 on 1st every month" → { intent: "SET_RECURRING", recurring_details: { description: "Rent", amount: 8000, direction: "EXPENSE", dayOfMonth: 1, period: "MONTHLY" } }
    - Example: "salary 30000 on 25th monthly" → { intent: "SET_RECURRING", recurring_details: { description: "Salary", amount: 30000, direction: "INCOME", dayOfMonth: 25, period: "MONTHLY" } }
    - Example: "around 500-700 electricity on 15th monthly" → { intent: "SET_RECURRING", recurring_details: { description: "Electricity", amountMin: 500, amountMax: 700, direction: "EXPENSE", dayOfMonth: 15, period: "MONTHLY" } }
    - Example: "quarterly insurance 2500 on 10th" → { intent: "SET_RECURRING", recurring_details: { description: "Insurance", amount: 2500, direction: "EXPENSE", dayOfMonth: 10, period: "QUARTERLY" } }

11. **GROUP_SETUP (Family/Group management):**
    - User wants to create a shared family group or join an existing one.
    - Example: "create a family group" / "start family tracking" / "I want to track with my wife" / "add my family" → { intent: "GROUP_SETUP", group_action: { action: "CREATE" } }
    - Example: "join my family group" / "I have an invite code ABC123" → { intent: "GROUP_SETUP", group_action: { action: "JOIN", code: "ABC123" } }
    - Do NOT use CHAT for these — always use GROUP_SETUP when the user wants to share expense tracking with family or others.

### RULES:
- Identify the *User's* perspective. If I say "Raju paid me", money comes to ME (RECEIVED).
- Ignore spelling mistakes.
- CHAT is ONLY for social/non-financial messages. ANY message about money, spending, income, balances, or contacts — even in a casual tone — MUST use QUERY (or PAID/RECEIVED). Never use CHAT for financial questions.
- If the text is asking for data/analytics about finances, ALWAYS use QUERY — even if it sounds casual.
- **IMPORTANT**: Extract a 'description' field separately from 'category'.
  - 'description': What happened (e.g. "Taxi to airport").
  - 'category': Classification (e.g. "Travel").
- Always output strict JSON.
`;

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

  async parseText(
    text: string,
    replyTransaction?: Transaction | null,
    history: ConversationTurn[] = [],
  ): Promise<ParsedData> {
    try {
      const today = new Date().toISOString().split("T")[0];
      let promptText = `[Today: ${today}]\n${text}`;
      if (replyTransaction) {
        promptText = `[Today: ${today}]
Context: User is replying to a message/transaction.
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
          temperature: 0.1,
        },
      });

      const responseText = response?.text;
      console.log("GeminiParser Response:", responseText);
      if (!responseText) {
        throw new Error("GeminiParser: Empty response from AI.");
      }

      const parsed = JSON.parse(responseText) as ParsedData;
      return parsed;
    } catch (error) {
      console.error("GeminiParser Error:", error);
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
