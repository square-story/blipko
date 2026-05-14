import { GoogleGenAI, Type, Content } from "@google/genai";
import { ConversationTurn } from "../../domain/services/IAiParser";
import { ITransactionRepository } from "../../domain/repositories/ITransactionRepository";
import { IContactRepository } from "../../domain/repositories/IContactRepository";
import { env } from "../../config/env";

const QUERY_AGENT_PROMPT = `You are a financial assistant for Blipko, an Indian expense tracker.
You have tools to query the user's transaction database. Use them to answer financial questions accurately.
After getting a tool result, respond naturally in 1-2 sentences. Use ₹ for Indian Rupee amounts. Be concise and friendly.`;

const functionDeclarations = [
  {
    name: "aggregate_transactions",
    description:
      "Get total amount and count of transactions in a date range, optionally filtered by direction (PAID/RECEIVED) and category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        from_date: { type: Type.STRING, description: "Start date YYYY-MM-DD" },
        to_date: { type: Type.STRING, description: "End date YYYY-MM-DD" },
        intent: {
          type: Type.STRING,
          description: "Filter by PAID (outgoing) or RECEIVED (incoming)",
        },
        category: { type: Type.STRING, description: "Filter by category name" },
      },
      required: ["from_date", "to_date"],
    },
  },
  {
    name: "get_contact_balance",
    description: "Get the current balance for a specific contact by name.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        contact_name: {
          type: Type.STRING,
          description: "Name of the contact to look up",
        },
      },
      required: ["contact_name"],
    },
  },
  {
    name: "list_unpaid_contacts",
    description:
      "List contacts who owe the user money (negative balance = they owe the user).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

export class GeminiQueryAgent {
  private client: GoogleGenAI;

  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly contactRepository: IContactRepository,
    private readonly apiKey: string = env.GEMINI_API_KEY,
    private readonly modelName: string = env.GEMINI_MODEL,
  ) {
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async resolve(
    userId: string,
    text: string,
    history: ConversationTurn[] = [],
  ): Promise<string> {
    const today = new Date().toISOString().split("T")[0];
    const promptText = `[Today: ${today}] ${text}`;

    const historyContents: Content[] = history.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));
    const userContent: Content = {
      role: "user",
      parts: [{ text: promptText }],
    };

    // Call 1: let Gemini pick and call a tool
    const res1 = await this.client.models.generateContent({
      model: this.modelName,
      contents: [...historyContents, userContent],
      config: {
        systemInstruction: QUERY_AGENT_PROMPT,
        tools: [{ functionDeclarations }],
        temperature: 0,
      },
    });

    const parts1 = (res1.candidates?.[0]?.content?.parts ?? []) as any[];
    const fnPart = parts1.find((p) => p.functionCall);

    if (!fnPart?.functionCall) {
      return res1.text ?? "I couldn't understand your query.";
    }

    const { name: fnName, args } = fnPart.functionCall as {
      name: string;
      args: Record<string, any>;
    };

    let dbResult: object;
    try {
      dbResult = await this.executeDbTool(userId, fnName, args);
    } catch (err) {
      console.error("GeminiQueryAgent DB error:", err);
      return "Something went wrong while fetching your data. Please try again.";
    }

    // Call 2: format DB result as natural language
    const call2Contents: Content[] = [
      ...historyContents,
      userContent,
      {
        role: "model",
        parts: [{ functionCall: { name: fnName, args } }],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: fnName,
              response: dbResult as Record<string, unknown>,
            },
          },
        ],
      },
    ];
    const res2 = await this.client.models.generateContent({
      model: this.modelName,
      contents: call2Contents,
      config: { systemInstruction: QUERY_AGENT_PROMPT, temperature: 0.2 },
    });

    return res2.text ?? `Here's what I found: ${JSON.stringify(dbResult)}`;
  }

  private async executeDbTool(
    userId: string,
    name: string,
    args: Record<string, any>,
  ): Promise<object> {
    switch (name) {
      case "aggregate_transactions": {
        const from = new Date(args.from_date as string);
        const to = new Date(args.to_date as string);
        to.setHours(23, 59, 59, 999);
        const txs = await this.transactionRepository.findByDateRange(
          userId,
          from,
          to,
        );
        const filtered = txs.filter(
          (tx) =>
            (!args.intent || tx.intent === args.intent) &&
            (!args.category ||
              tx.category?.toLowerCase() ===
                String(args.category).toLowerCase()),
        );
        const total = filtered.reduce((s, tx) => s + Number(tx.amount), 0);
        return { total, count: filtered.length };
      }

      case "get_contact_balance": {
        const contact = await this.contactRepository.findSimilarByName(
          userId,
          args.contact_name as string,
        );
        if (!contact) return { error: "Contact not found" };
        const balance = Number(contact.currentBalance);
        return {
          name: contact.name,
          balance,
          status:
            balance < 0 ? "owes_you" : balance > 0 ? "you_owe" : "settled",
        };
      }

      case "list_unpaid_contacts": {
        const unpaid =
          await this.transactionRepository.findUnpaidContacts(userId);
        return { contacts: unpaid.slice(0, 10) };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
