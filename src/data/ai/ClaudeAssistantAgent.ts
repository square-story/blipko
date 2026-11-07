import Anthropic from "@anthropic-ai/sdk";
import {
  AssistantAnswer,
  AssistantContext,
  IAssistantAgent,
  ToolCallRecord,
} from "../../domain/services/IAssistantAgent";
import { IFinancialDataTools } from "../../domain/services/IFinancialDataTools";
import { IAssistantWriteTools } from "../../domain/services/IAssistantWriteTools";
import { buildAssistantTools, runAssistantTool } from "./assistantTools";
import { trimHistory } from "./historyTrimmer";
import { findUngroundedAmounts } from "./groundingCheck";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

const PROVIDER = "anthropic";
const MAX_ROUNDS = 5;
// `max_tokens` caps thinking AND response text together. At 1024 with thinking
// on, a round could spend the whole budget reasoning and return no text block at
// all — which surfaced as "model returned no answer" in production. Billing is on
// actual usage, so the headroom costs nothing on a normal turn.
const MAX_OUTPUT_TOKENS = 4096;
// Per-request ceiling. AssistantProcessor aborts the whole turn at 25s; bounding
// each round stops one slow call from consuming that budget by itself.
const REQUEST_TIMEOUT_MS = 20_000;
// Leaves room for the system prompt, tool definitions and this turn's results.
const MAX_HISTORY_TOKENS = 4000;

// Tool-calling assistant over the user's own financial data.
//
// Grounding is enforced by the tool layer, not by pleading in the prompt: every
// amount arrives pre-formatted, every comparison arrives pre-decided, and the
// tool schemas name the user's real categories. What is left here is replay
// fidelity (tool_use/tool_result pairs survive trimming) and measurement
// (ungroundedAmounts).
export class ClaudeAssistantAgent implements IAssistantAgent {
  private client: Anthropic;

  constructor(
    private readonly tools: IFinancialDataTools,
    private readonly writes: IAssistantWriteTools | null = null,
    apiKey: string = env.ANTHROPIC_API_KEY,
    private readonly model: string = env.ANTHROPIC_MODEL,
  ) {
    if (!apiKey) throw new Error("ClaudeAssistantAgent: API key is missing.");
    // The SDK retries twice by default with backoff. Under a 25s turn budget a
    // retry cannot fit: it only burns the budget, and the abort then fires
    // mid-retry so the surfaced error is the abort rather than the 429 or 529
    // that caused it. Failing fast makes the real status reach the log.
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async answer(
    question: string,
    ctx: AssistantContext,
  ): Promise<AssistantAnswer> {
    const startedAt = Date.now();
    const categories = await this.tools.getCategories(ctx.userId);
    const categoryNames = categories.categories.map((c) => c.name);
    const toolDefs = buildAssistantTools(categoryNames, this.writes !== null);

    const messages: Anthropic.MessageParam[] = [
      ...trimHistory(toMessages(ctx.history ?? []), MAX_HISTORY_TOKENS),
      { role: "user", content: question },
    ];

    const toolCalls: ToolCallRecord[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    // Turn-local, NOT instance state — this agent is a singleton shared by every
    // user, so a field here would leak one user's proposal into another's turn.
    let proposalMade = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Both are stated rather than inherited. On Sonnet 5 an omitted
          // `thinking` runs adaptive and an omitted `effort` runs `high` — so
          // leaving them out was not "no thinking", it was the most expensive
          // setting, silently. Thinking stays ON: disabling it makes the model
          // reach for tools less often, which is the wrong trade for an agent
          // whose every figure has to come from a tool. `low` is the fit for
          // short, scoped work under a 25s budget.
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: this.systemPrompt(ctx),
          tools: toolDefs,
          messages,
        },
        {
          timeout: REQUEST_TIMEOUT_MS,
          ...(ctx.signal && { signal: ctx.signal }),
        },
      );

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;

      const requests = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (requests.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        if (!text) {
          // Two different bugs used to share one message. Truncation means the
          // round spent max_tokens on thinking and never reached a text block —
          // raise MAX_OUTPUT_TOKENS or lower effort. An empty response with a
          // normal stop_reason is a genuine provider anomaly.
          if (response.stop_reason === "max_tokens") {
            throw new Error(
              `ClaudeAssistantAgent: hit max_tokens (${MAX_OUTPUT_TOKENS}) before producing an answer.`,
            );
          }
          throw new Error(
            `ClaudeAssistantAgent: model returned no answer (stop_reason=${response.stop_reason}).`,
          );
        }
        return this.finish(
          text,
          toolCalls,
          startedAt,
          inputTokens,
          outputTokens,
          ctx,
        );
      }

      messages.push({ role: "assistant", content: response.content });

      // Reads fan out; proposals are serialised behind a one-per-turn guard.
      //
      // Only ONE pending action can be surfaced (the user gets one pair of
      // buttons), so allowing several to be staged means the button applies
      // whichever result happened to resolve last while the prose describes
      // another. Refusing the second keeps the confirmed action and the
      // described action the same thing by construction.
      const reads = requests.filter((r) => !isProposal(r.name));
      const proposals = requests.filter((r) => isProposal(r.name));

      const results = new Map<string, unknown>();
      await Promise.all(
        reads.map(async (req) => {
          results.set(req.id, await this.callTool(req, ctx, categoryNames));
        }),
      );
      for (const req of proposals) {
        if (proposalMade) {
          results.set(req.id, {
            ok: false,
            error: "proposal_already_pending",
            message:
              "You already proposed a change this turn, and the user can only confirm one at a time. Describe this one and wait for them to ask again.",
          });
          continue;
        }
        const result = await this.callTool(req, ctx, categoryNames);
        // Latch immediately, not after the loop — two proposals in the SAME
        // round would both see `false` otherwise, which is the exact case the
        // guard exists for.
        if (isSuccessfulProposal(result)) proposalMade = true;
        results.set(req.id, result);
      }

      // Record in the model's original request order, so the trace reads the
      // way the turn actually happened rather than in completion order.
      for (const req of requests) {
        toolCalls.push({
          name: req.name,
          args: req.input,
          result: results.get(req.id),
        });
      }

      messages.push({
        role: "user",
        content: requests.map((req) => ({
          type: "tool_result" as const,
          tool_use_id: req.id,
          content: JSON.stringify(results.get(req.id)),
        })),
      });
    }

    throw new Error("ClaudeAssistantAgent: exceeded tool-call rounds.");
  }

  private callTool(
    req: Anthropic.ToolUseBlock,
    ctx: AssistantContext,
    categoryNames: string[],
  ): Promise<unknown> {
    return runAssistantTool(
      {
        tools: this.tools,
        writes: this.writes,
        userId: ctx.userId,
        categoryNames,
        dashboardUrl: ctx.dashboardUrl,
      },
      req.name,
      req.input,
    );
  }

  private finish(
    text: string,
    toolCalls: ToolCallRecord[],
    startedAt: number,
    inputTokens: number,
    outputTokens: number,
    ctx: AssistantContext,
  ): AssistantAnswer {
    const ungroundedAmounts = findUngroundedAmounts(
      text,
      toolCalls.map((c) => c.result),
    );
    if (ungroundedAmounts.length > 0) {
      logger.warn("Assistant stated amounts absent from every tool result", {
        component: "assistant",
        userId: ctx.userId,
        amounts: ungroundedAmounts,
        tools: toolCalls.map((c) => c.name),
      });
    }

    return {
      text,
      toolCalls,
      model: this.model,
      provider: PROVIDER,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      ungroundedAmounts,
      pendingAction: latestProposal(toolCalls),
      dashboardUrl: requestedDashboard(toolCalls),
    };
  }

  private systemPrompt(ctx: AssistantContext): Anthropic.TextBlockParam[] {
    return [
      {
        type: "text",
        text: `You are Blipko, a budgeting assistant in a Telegram chat. The user follows a 50/30/20 budget (NEEDS 50%, WANTS 30%, SAVINGS 20%) on a payday-based cycle.

User context:
- Currency: ${ctx.currency} (amounts are written with ₹)
- Today: ${ctx.today}
- Current cycle: ${ctx.period.start} to ${ctx.period.end} (day ${ctx.period.day} of ${ctx.period.daysInPeriod}, ${ctx.period.remainingDays} left)
- Payday: day ${ctx.payday} of the month
- Expected monthly income: ${ctx.monthlyIncome}

How to answer:
- Every figure you state must appear in a tool result from this conversation. Copy the tool's formatted amounts exactly — do not re-round, re-format, or combine them.
- Do not calculate. Differences, totals, per-day figures and yes/no verdicts all have a tool that returns them already decided. If you find yourself about to do arithmetic, you are using the wrong tool.
- Dates you send to tools are YYYY-MM-DD in the user's local time and the end date is INCLUSIVE. Resolve "yesterday"/"last week"/"this month" against today's date above.
- Honour a "note" on a tool result. An empty result means nothing was logged — never report that as ₹0 spent.
- On { "ok": false }, read the error and retry with corrected arguments. Never present a failed call as data.
- Say which window your numbers cover; the tools echo back the range they used.
- If the tools cannot answer the question, say so plainly rather than estimating.

Questions about Blipko itself — what you can do, how something works, how it helps them, who built it, where the dashboard is — are in scope. Answer them with get_product_info, never from your own knowledge: a feature you invent sends the user looking for something that does not exist. Use open_dashboard when what they want genuinely lives there.

Style: short and skimmable for Telegram. *bold* for key numbers, no preamble, no sign-off. Discuss the user's money and Blipko itself; politely decline anything else. Never recommend specific investments, funds, stocks, insurance or tax strategies — you are not a registered adviser. You may describe the user's own savings figures; for advice, suggest a SEBI-registered investment adviser.`,
        // The system prompt and tool definitions are identical between turns;
        // caching them cuts input cost sharply on a multi-round conversation.
        cache_control: { type: "ephemeral" },
      },
    ];
  }
}

// The URL from a successful open_dashboard call, so the caller can render a
// button. Explicit: the model asks for it, we do not infer it from the text.
function requestedDashboard(toolCalls: ToolCallRecord[]): string | undefined {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i]!;
    const r = call.result as { ok?: boolean; url?: string } | undefined;
    if (call.name === "open_dashboard" && r?.ok === true && r.url) return r.url;
  }
  return undefined;
}

function isProposal(toolName: string): boolean {
  return toolName.startsWith("propose_");
}

function isSuccessfulProposal(result: unknown): boolean {
  const r = result as { ok?: boolean; pendingId?: string; summary?: string };
  return r?.ok === true && Boolean(r.pendingId) && Boolean(r.summary);
}

// The turn's proposal. The one-per-turn guard in `answer` means there is at most
// one, so this is a lookup rather than a tie-break — a revised proposal after a
// soft error is still the only successful one.
function latestProposal(
  toolCalls: ToolCallRecord[],
): { id: string; summary: string } | undefined {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const r = toolCalls[i]!.result as { pendingId: string; summary: string };
    if (isSuccessfulProposal(r)) {
      return { id: r.pendingId, summary: r.summary };
    }
  }
  return undefined;
}

// Replay stored turns as real chat messages. Tool traces are NOT replayed as
// tool_use/tool_result blocks: those would need the original provider block ids
// to stay valid, and a stale id is rejected outright. The prior answer's text
// carries the conclusions forward, which is what a follow-up actually needs.
function toMessages(
  history: { role: string; content: string }[],
): Anthropic.MessageParam[] {
  return history
    .filter((h) => h.content.trim().length > 0)
    .map((h) => ({
      role: h.role === "model" ? ("assistant" as const) : ("user" as const),
      content: h.content,
    }));
}
