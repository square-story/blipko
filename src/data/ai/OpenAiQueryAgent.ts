import OpenAI from "openai";
import { Bucket } from "@prisma/client";
import {
  IFinancialQueryAgent,
  QueryAgentContext,
} from "../../domain/services/IFinancialQueryAgent";
import {
  DateRange,
  IFinancialDataTools,
} from "../../domain/services/IFinancialDataTools";
import { env } from "../../config/env";

const BUCKETS = ["NEEDS", "WANTS", "SAVINGS"] as const;
const MAX_ROUNDS = 5;

// Read-only conversational agent. Given a question, it plans tool calls over the
// user's real data (IFinancialDataTools) and composes a grounded answer. It can
// only read — there are no write tools.
export class OpenAiQueryAgent implements IFinancialQueryAgent {
  private client: OpenAI;

  constructor(
    private readonly tools: IFinancialDataTools,
    apiKey: string = env.OPENAI_API_KEY,
    private readonly model: string = "gpt-4o-mini",
  ) {
    if (!apiKey) throw new Error("OpenAiQueryAgent: API Key is missing.");
    this.client = new OpenAI({ apiKey });
  }

  async answer(question: string, ctx: QueryAgentContext): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: this.systemPrompt(ctx) },
      ...(ctx.history ?? []).map((h) => ({
        role: (h.role === "model" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: h.content,
      })),
      { role: "user", content: question },
    ];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: TOOL_SCHEMAS,
        tool_choice: "auto",
        temperature: 0.2,
      });

      const msg = completion.choices[0]?.message;
      if (!msg) throw new Error("OpenAiQueryAgent: empty completion.");

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          if (call.type !== "function") continue;
          const result = await this.runTool(
            call.function.name,
            call.function.arguments,
            ctx.userId,
          );
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const text = msg.content?.trim();
      if (text) return text;
      throw new Error("OpenAiQueryAgent: model returned no answer.");
    }

    throw new Error("OpenAiQueryAgent: exceeded tool-call rounds.");
  }

  private systemPrompt(ctx: QueryAgentContext): string {
    const today = ctx.now.toISOString().split("T")[0];
    return `You are Blipko's budgeting assistant. The user follows a 50/30/20 budget (NEEDS 50%, WANTS 30%, SAVINGS 20%) on a payday-based cycle. Answer the user's question about THEIR money using the tools — never invent numbers.

User context:
- Currency: ${ctx.currency} (format amounts with ₹)
- Today: ${today}
- Current budget cycle: ${ctx.period.start.split("T")[0]} to ${ctx.period.end.split("T")[0]} (day ${ctx.period.day} of ${ctx.period.daysInPeriod}, ${ctx.period.remainingDays} left)
- Payday: day ${ctx.payday} of the month
- Expected monthly income: ${ctx.monthlyIncome}

Rules:
- ALWAYS call tools to get real figures before stating any number. If a tool returns nothing, say there's no data for that — don't guess.
- Resolve relative dates ("last week", "this month", "yesterday") to explicit ISO from/to using today's date, and pass them to the tools. Omit the range to use the current cycle.
- For "can I afford X?" use get_period_status: compare the amount to the remaining budget in the relevant bucket and the days left, then give a clear yes/no with the numbers.
- Keep replies short and skimmable for Telegram. Use Markdown sparingly (*bold* for key numbers). Use ₹ for money. No preamble.
- Only answer questions about the user's budget/spending/income. Politely decline anything else.`;
  }

  private async runTool(
    name: string,
    rawArgs: string,
    userId: string,
  ): Promise<unknown> {
    let args: Record<string, unknown> = {};
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      return { error: "invalid tool arguments" };
    }
    const range: DateRange = {
      from: asString(args.from),
      to: asString(args.to),
    };
    const bucket = asBucket(args.bucket);

    switch (name) {
      case "get_period_status":
        return this.tools.getPeriodStatus(userId);
      case "get_spend_by_bucket":
        return this.tools.getSpendByBucket(userId, range, bucket);
      case "get_spend_by_category":
        return this.tools.getSpendByCategory(
          userId,
          range,
          bucket,
          asNumber(args.limit),
        );
      case "get_income":
        return this.tools.getIncome(userId, range);
      case "get_recent_expenses":
        return this.tools.getRecentExpenses(userId, {
          limit: asNumber(args.limit),
          category: asString(args.category),
          range: args.from || args.to ? range : undefined,
        });
      case "get_recurring_rules":
        return this.tools.getRecurringRules(userId);
      default:
        return { error: `unknown tool: ${name}` };
    }
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asBucket(v: unknown): Bucket | undefined {
  return typeof v === "string" && (BUCKETS as readonly string[]).includes(v)
    ? (v as Bucket)
    : undefined;
}

const RANGE_PROPS = {
  from: {
    type: "string",
    description: "ISO start date (inclusive). Omit for the current cycle.",
  },
  to: {
    type: "string",
    description: "ISO end date (exclusive). Omit for the current cycle.",
  },
} as const;

const BUCKET_PROP = {
  bucket: {
    type: "string",
    enum: ["NEEDS", "WANTS", "SAVINGS"],
    description: "Optional 50/30/20 bucket filter.",
  },
} as const;

const TOOL_SCHEMAS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_period_status",
      description:
        "Current-cycle budget health: per-bucket budget/spent/remaining/percent, days left, and effective income. Use for overall status and affordability checks.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spend_by_bucket",
      description:
        "Total spend per bucket over a date range (defaults to the current cycle). Pass a bucket to scope to one.",
      parameters: {
        type: "object",
        properties: { ...RANGE_PROPS, ...BUCKET_PROP },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spend_by_category",
      description:
        "Top spending categories over a date range (defaults to the current cycle), highest first. Optional bucket filter and limit.",
      parameters: {
        type: "object",
        properties: {
          ...RANGE_PROPS,
          ...BUCKET_PROP,
          limit: { type: "number", description: "Max categories (default 5)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_income",
      description:
        "Total income logged over a date range (defaults to the current cycle).",
      parameters: { type: "object", properties: { ...RANGE_PROPS } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_expenses",
      description:
        "Most recent expenses, newest first. Optional category name and date range. Use for 'last few spends' or 'when did I last spend on X'.",
      parameters: {
        type: "object",
        properties: {
          ...RANGE_PROPS,
          category: {
            type: "string",
            description: "Optional category name to filter by.",
          },
          limit: { type: "number", description: "Max rows (default 10)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recurring_rules",
      description:
        "The user's active recurring income/expense rules (amount, day of month, bucket, category).",
      parameters: { type: "object", properties: {} },
    },
  },
];
