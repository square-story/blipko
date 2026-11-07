import OpenAI from "openai";
import {
  IFinancialQueryAgent,
  QueryAgentContext,
} from "../../domain/services/IFinancialQueryAgent";
import { IFinancialDataTools } from "../../domain/services/IFinancialDataTools";
import { buildOpenAiTools, runAssistantTool } from "./assistantTools";
import { env } from "../../config/env";

const MAX_ROUNDS = 5;

// Read-only conversational agent. Given a question, it plans tool calls over the
// user's real data and composes a grounded answer. It can only read.
//
// The tool catalog, the per-request category enum and the soft-error contract
// all live in assistantTools.ts, shared with the Claude assistant so the two
// paths cannot drift. This one is the fallback when the assistant lane is off.
export class OpenAiQueryAgent implements IFinancialQueryAgent {
  private client: OpenAI;

  constructor(
    private readonly tools: IFinancialDataTools,
    apiKey: string = env.OPENAI_API_KEY,
    private readonly model: string = env.OPENAI_PARSER_MODEL,
  ) {
    if (!apiKey) throw new Error("OpenAiQueryAgent: API Key is missing.");
    this.client = new OpenAI({ apiKey });
  }

  async answer(question: string, ctx: QueryAgentContext): Promise<string> {
    const categories = await this.tools.getCategories(ctx.userId);
    const categoryNames = categories.categories.map((c) => c.name);
    const toolSchemas = buildOpenAiTools(categoryNames);

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
        tools: toolSchemas,
        tool_choice: "auto",
        temperature: 0.2,
      });

      const msg = completion.choices[0]?.message;
      if (!msg) throw new Error("OpenAiQueryAgent: empty completion.");

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);
        const results = await Promise.all(
          msg.tool_calls.map(async (call) =>
            call.type === "function"
              ? {
                  id: call.id,
                  result: await runAssistantTool(
                    {
                      tools: this.tools,
                      userId: ctx.userId,
                      categoryNames,
                      dashboardUrl: ctx.dashboardUrl,
                    },
                    call.function.name,
                    call.function.arguments,
                  ),
                }
              : null,
          ),
        );
        for (const r of results) {
          if (!r) continue;
          messages.push({
            role: "tool",
            tool_call_id: r.id,
            content: JSON.stringify(r.result),
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
    return `You are Blipko's budgeting assistant. The user follows a 50/30/20 budget (NEEDS 50%, WANTS 30%, SAVINGS 20%) on a payday-based cycle.

User context:
- Currency: ${ctx.currency} (format amounts with ₹)
- Today: ${ctx.today}
- Current budget cycle: ${ctx.period.start} to ${ctx.period.end} (day ${ctx.period.day} of ${ctx.period.daysInPeriod}, ${ctx.period.remainingDays} left)
- Payday: day ${ctx.payday} of the month
- Expected monthly income: ${ctx.monthlyIncome}

Rules:
- Every figure you state must come from a tool result in this conversation. Quote the tool's formatted amounts exactly as given — do not re-format, re-round, or recompute them.
- Do not do arithmetic. If a question needs a difference, a total, a per-day figure or a yes/no verdict, there is a tool that returns it already computed. Use that tool.
- Dates you pass to tools are YYYY-MM-DD in the user's local time, and the end date is INCLUSIVE. Resolve "last week"/"yesterday"/"this month" against today's date above. Omit both to use the current cycle.
- If a tool result carries a "note", honour it — an empty result means nothing was logged, which is NOT the same as the user having spent ₹0.
- If a tool returns { "ok": false }, read the error and try a corrected call. Never present a failed call as data.
- State the window you are talking about (the tools echo back the range they used).
- Keep replies short and skimmable for Telegram. Use Markdown sparingly (*bold* for key numbers). No preamble.
- Questions about Blipko itself (what you can do, how it works, who built it, the dashboard) are in scope — answer them with get_product_info rather than from your own knowledge. Use open_dashboard when what they want lives there.
- Politely decline anything outside the user's money and Blipko itself.
- Never recommend specific investments, funds, stocks, insurance or tax strategies — you are not a registered adviser. You may describe the user's own savings figures; for advice, suggest a SEBI-registered investment adviser.`;
  }
}
