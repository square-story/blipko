import { describe, it, expect, vi, beforeEach } from "vitest";

const { create, ctorOptions } = vi.hoisted(() => ({
  create: vi.fn(),
  ctorOptions: [] as any[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(options: any) {
      ctorOptions.push(options);
    }
  },
}));

vi.mock("../../config/env", () => ({
  env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "claude-sonnet-5" },
}));

import { ClaudeAssistantAgent } from "./ClaudeAssistantAgent";

const ctx = {
  userId: "u1",
  currency: "INR",
  payday: 1,
  monthlyIncome: "₹50,000",
  today: "2026-08-11",
  period: {
    start: "2026-08-01",
    end: "2026-08-31",
    day: 11,
    daysInPeriod: 31,
    remainingDays: 21,
  },
};

const usage = { input_tokens: 100, output_tokens: 20 };

function says(text: string) {
  return { content: [{ type: "text", text }], usage };
}

function callsTool(name: string, input: object = {}) {
  return {
    content: [{ type: "tool_use", id: "tu_1", name, input }],
    usage,
  };
}

describe("ClaudeAssistantAgent", () => {
  let tools: any;
  let writes: any;
  let agent: ClaudeAssistantAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    ctorOptions.length = 0;
    tools = {
      getCategories: vi.fn().mockResolvedValue({
        categories: [
          { name: "Food", bucket: "WANTS", monthlyBudget: "₹5,000" },
        ],
      }),
      getPeriodStatus: vi.fn().mockResolvedValue({ buckets: [] }),
      getSpendByCategory: vi.fn().mockResolvedValue({
        range: { from: "2026-08-01", to: "2026-08-11" },
        categories: [{ name: "Food", total: "₹1,200" }],
      }),
      getRecentExpenses: vi.fn().mockResolvedValue({ rows: [] }),
      checkAffordability: vi.fn().mockResolvedValue({ verdict: "YES" }),
      compareCycles: vi.fn().mockResolvedValue({ cycles: [] }),
      getBoxes: vi.fn().mockResolvedValue({ boxes: [] }),
      getIncome: vi.fn().mockResolvedValue({ total: "₹0" }),
      getSpendByBucket: vi.fn().mockResolvedValue({ buckets: [] }),
      getRecurringRules: vi.fn().mockResolvedValue({ rules: [] }),
    };
    writes = {
      proposeBoxMove: vi.fn(),
      proposeRecurring: vi.fn(),
      proposeDeleteExpense: vi.fn(),
      proposeExpenseEdit: vi.fn(),
    };
    agent = new ClaudeAssistantAgent(
      tools,
      writes,
      "test-key",
      "claude-sonnet-5",
    );
  });

  it("returns the answer text with provider metadata for the turn log", async () => {
    create.mockResolvedValueOnce(says("You spent *₹1,200* on Food."));
    const answer = await agent.answer("how much on food?", ctx);

    expect(answer.text).toBe("You spent *₹1,200* on Food.");
    expect(answer.provider).toBe("anthropic");
    expect(answer.model).toBe("claude-sonnet-5");
    expect(answer.inputTokens).toBe(100);
    expect(answer.outputTokens).toBe(20);
    expect(answer.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("runs a tool round and records the trace", async () => {
    create
      .mockResolvedValueOnce(
        callsTool("get_spend_by_category", { category: "Food" }),
      )
      .mockResolvedValueOnce(says("*₹1,200* on Food."));

    const answer = await agent.answer("food spend?", ctx);

    expect(tools.getSpendByCategory).toHaveBeenCalled();
    expect(answer.toolCalls).toEqual([
      {
        name: "get_spend_by_category",
        args: { category: "Food" },
        result: expect.objectContaining({ ok: true }),
      },
    ]);
  });

  it("sums token usage across every round, not just the last", async () => {
    create
      .mockResolvedValueOnce(callsTool("get_period_status"))
      .mockResolvedValueOnce(says("all good"));

    const answer = await agent.answer("status?", ctx);
    expect(answer.inputTokens).toBe(200);
    expect(answer.outputTokens).toBe(40);
  });

  it("feeds a tool_result back paired to its tool_use id", async () => {
    create
      .mockResolvedValueOnce(callsTool("get_period_status"))
      .mockResolvedValueOnce(says("done"));

    await agent.answer("status?", ctx);

    const secondCall = create.mock.calls[1]![0];
    const resultMsg = secondCall.messages[secondCall.messages.length - 1];
    expect(resultMsg.role).toBe("user");
    expect(resultMsg.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "tu_1",
    });
  });

  it("hands a failing tool back as data so the model can recover", async () => {
    tools.getPeriodStatus.mockRejectedValue(new Error("db down"));
    create
      .mockResolvedValueOnce(callsTool("get_period_status"))
      .mockResolvedValueOnce(says("Sorry, I can't reach that right now."));

    const answer = await agent.answer("status?", ctx);
    expect(answer.text).toContain("can't reach");
    expect(answer.toolCalls[0]!.result).toMatchObject({
      ok: false,
      error: "tool_failed",
    });
  });

  it("constrains the category param to the user's real categories", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    const defs = create.mock.calls[0]![0].tools;
    const recent = defs.find((t: any) => t.name === "get_recent_expenses");
    expect(recent.input_schema.properties.category.enum).toEqual(["Food"]);
  });

  it("flags amounts that appear in no tool result", async () => {
    create
      .mockResolvedValueOnce(callsTool("get_spend_by_category", {}))
      // ₹1,200 is real; ₹9,999 is invented.
      .mockResolvedValueOnce(says("Food was ₹1,200, so you have ₹9,999 left."));

    const answer = await agent.answer("food?", ctx);
    expect(answer.ungroundedAmounts).toEqual(["₹9,999"]);
  });

  it("reports no ungrounded amounts when every figure came from a tool", async () => {
    create
      .mockResolvedValueOnce(callsTool("get_spend_by_category", {}))
      .mockResolvedValueOnce(says("Food was ₹1,200."));

    const answer = await agent.answer("food?", ctx);
    expect(answer.ungroundedAmounts).toEqual([]);
  });

  describe("one proposal per turn", () => {
    // Only one pair of confirm buttons is ever rendered, so a second staged
    // proposal would leave the button applying one action while the prose
    // describes another.
    function twoProposals() {
      return {
        content: [
          {
            type: "tool_use",
            id: "tu_1",
            name: "propose_box_move",
            input: { box: "Emergency", amount: 5000, direction: "OUT" },
          },
          {
            type: "tool_use",
            id: "tu_2",
            name: "propose_box_move",
            input: { box: "Vacation", amount: 1000, direction: "IN" },
          },
        ],
        usage,
      };
    }

    beforeEach(() => {
      let n = 0;
      writes.proposeBoxMove = vi.fn(async () => {
        n += 1;
        return { ok: true, pendingId: `p${n}`, summary: `proposal ${n}` };
      });
    });

    it("stages only the first of two proposals in the same round", async () => {
      create
        .mockResolvedValueOnce(twoProposals())
        .mockResolvedValueOnce(says("done"));

      const a = await agent.answer("move money around", ctx);
      expect(writes.proposeBoxMove).toHaveBeenCalledTimes(1);
      expect(a.toolCalls[1]!.result).toMatchObject({
        ok: false,
        error: "proposal_already_pending",
      });
    });

    it("surfaces the proposal that was actually staged", async () => {
      create
        .mockResolvedValueOnce(twoProposals())
        .mockResolvedValueOnce(says("done"));

      const a = await agent.answer("move money around", ctx);
      expect(a.pendingAction).toEqual({ id: "p1", summary: "proposal 1" });
    });

    it("refuses a second proposal in a later round too", async () => {
      create
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Goa trip",
            amount: 1,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Goa trip",
            amount: 2,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(says("done"));

      const a = await agent.answer("two things", ctx);
      expect(writes.proposeBoxMove).toHaveBeenCalledTimes(1);
      expect(a.pendingAction).toEqual({ id: "p1", summary: "proposal 1" });
    });

    it("does not count a failed proposal against the guard", async () => {
      writes.proposeBoxMove = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: "unknown_box" })
        .mockResolvedValueOnce({
          ok: true,
          pendingId: "p9",
          summary: "retried",
        });
      create
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Bali",
            amount: 100,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Goa trip",
            amount: 100,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(says("done"));

      const a = await agent.answer("add to bali", ctx);
      expect(a.pendingAction).toEqual({ id: "p9", summary: "retried" });
    });

    it("keeps the guard turn-local — the agent is shared across users", async () => {
      create
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Goa trip",
            amount: 100,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(says("done"))
        .mockResolvedValueOnce(
          callsTool("propose_box_move", {
            box: "Goa trip",
            amount: 100,
            direction: "IN",
          }),
        )
        .mockResolvedValueOnce(says("done"));

      await agent.answer("first user's turn", ctx);
      const second = await agent.answer("another turn", ctx);

      // A field on the agent would have blocked this one.
      expect(second.pendingAction).toBeDefined();
      expect(writes.proposeBoxMove).toHaveBeenCalledTimes(2);
    });

    it("still runs reads in the same round as a proposal", async () => {
      create
        .mockResolvedValueOnce({
          content: [
            { type: "tool_use", id: "tu_1", name: "get_boxes", input: {} },
            {
              type: "tool_use",
              id: "tu_2",
              name: "propose_box_move",
              input: { box: "Goa trip", amount: 100, direction: "IN" },
            },
          ],
          usage,
        })
        .mockResolvedValueOnce(says("done"));

      const a = await agent.answer("add to goa", ctx);
      expect(tools.getBoxes).toHaveBeenCalled();
      expect(writes.proposeBoxMove).toHaveBeenCalledTimes(1);
      // Trace stays in the model's request order, not completion order.
      expect(a.toolCalls.map((c) => c.name)).toEqual([
        "get_boxes",
        "propose_box_move",
      ]);
    });
  });

  it("caches the system prompt to keep multi-round turns cheap", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    expect(create.mock.calls[0]![0].system[0]).toMatchObject({
      cache_control: { type: "ephemeral" },
    });
  });

  it("declines investment advice and points to a SEBI-registered adviser", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    const system = create.mock.calls[0]![0].system[0].text;
    expect(system).toContain("SEBI-registered investment adviser");
  });

  it("anchors the prompt to the user's local date and cycle", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    const system = create.mock.calls[0]![0].system[0].text;
    expect(system).toContain("Today: 2026-08-11");
    expect(system).toContain("2026-08-01 to 2026-08-31");
  });

  it("stops after MAX_ROUNDS instead of looping forever", async () => {
    create.mockResolvedValue(callsTool("get_period_status"));
    await expect(agent.answer("status?", ctx)).rejects.toThrow(
      /exceeded tool-call rounds/,
    );
    expect(create).toHaveBeenCalledTimes(5);
  });

  it("throws rather than sending an empty reply", async () => {
    create.mockResolvedValueOnce({ content: [], usage });
    await expect(agent.answer("q", ctx)).rejects.toThrow(/no answer/);
  });

  // Sonnet 5 runs adaptive thinking when `thinking` is omitted and `high` effort
  // when `output_config` is omitted — so leaving these out was not "off", it was
  // the slowest and most expensive setting, silently. Combined with the old
  // 1024-token cap, thinking could consume the whole budget and the round would
  // return no text block at all: production's "Assistant failed".
  it("states thinking and effort instead of inheriting the model defaults", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    expect(create.mock.calls[0]![0]).toMatchObject({
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    });
  });

  it("budgets output tokens for thinking as well as the reply", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    expect(create.mock.calls[0]![0].max_tokens).toBeGreaterThanOrEqual(4096);
  });

  // The SDK retries twice by default. Under AssistantProcessor's 25s abort those
  // retries cannot complete — they just burn the budget, and the abort then fires
  // mid-retry so the logged error is the abort rather than the 429 that caused it.
  it("fails fast rather than letting SDK retries eat the turn budget", async () => {
    expect(ctorOptions[0]).toMatchObject({ maxRetries: 0 });
  });

  it("bounds each round so one slow call cannot consume the whole turn", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("q", ctx);

    expect(create.mock.calls[0]![1].timeout).toBeGreaterThan(0);
  });

  it("names truncation rather than reporting it as an empty answer", async () => {
    create.mockResolvedValueOnce({
      content: [{ type: "thinking", thinking: "" }],
      stop_reason: "max_tokens",
      usage,
    });

    await expect(agent.answer("q", ctx)).rejects.toThrow(/max_tokens/);
  });

  it("replays prior turns as chat messages", async () => {
    create.mockResolvedValueOnce(says("ok"));
    await agent.answer("and last month?", {
      ...ctx,
      history: [
        { role: "user", content: "food spend?", createdAt: new Date() },
        { role: "model", content: "₹1,200", createdAt: new Date() },
      ],
    } as any);

    const messages = create.mock.calls[0]![0].messages;
    expect(messages.map((m: any) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[2].content).toBe("and last month?");
  });

  it("passes the abort signal through to the provider", async () => {
    create.mockResolvedValueOnce(says("ok"));
    const controller = new AbortController();
    await agent.answer("q", { ...ctx, signal: controller.signal });

    expect(create.mock.calls[0]![1]).toMatchObject({
      signal: controller.signal,
    });
  });
});
