import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

// The real module parses process.env at import time and would fail without a
// full .env; the agent only reads OPENAI_API_KEY.
vi.mock("../../config/env", () => ({ env: { OPENAI_API_KEY: "test-key" } }));

import { OpenAiQueryAgent } from "./OpenAiQueryAgent";

const ctx = {
  userId: "u1",
  currency: "INR",
  locale: "en-IN",
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

// A completion that asks for one tool call.
function toolCall(name: string, args: object) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

function text(content: string) {
  return { choices: [{ message: { role: "assistant", content } }] };
}

// The tool result the agent fed back to the model on the Nth round.
function toolResultAt(round: number): any {
  const messages = create.mock.calls[round]![0].messages;
  const last = messages[messages.length - 1];
  return JSON.parse(last.content);
}

describe("OpenAiQueryAgent", () => {
  let tools: any;
  let agent: OpenAiQueryAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = {
      getCategories: vi.fn().mockResolvedValue({
        categories: [
          { name: "Food", bucket: "WANTS", monthlyBudget: "₹5,000" },
          { name: "Transport", bucket: "NEEDS", monthlyBudget: null },
        ],
      }),
      getBoxes: vi.fn().mockResolvedValue({ boxes: [{ name: "Goa trip" }] }),
      getPeriodStatus: vi.fn().mockResolvedValue({ buckets: [] }),
      getSpendByCategory: vi
        .fn()
        .mockResolvedValue({ range: {}, categories: [] }),
      getRecentExpenses: vi.fn().mockResolvedValue({ rows: [] }),
      checkAffordability: vi.fn().mockResolvedValue({ verdict: "YES" }),
      compareCycles: vi.fn().mockResolvedValue({ cycles: [] }),
    };
    agent = new OpenAiQueryAgent(tools, "test-key");
  });

  it("returns the model's text once it stops calling tools", async () => {
    create.mockResolvedValueOnce(text("You spent *₹1,200* on Food."));
    await expect(agent.answer("how much on food?", ctx)).resolves.toBe(
      "You spent *₹1,200* on Food.",
    );
  });

  describe("schemas are built from the user's real data", () => {
    it("constrains the category param to categories the user actually has", async () => {
      create.mockResolvedValueOnce(text("ok"));
      await agent.answer("q", ctx);

      const schemas = create.mock.calls[0]![0].tools;
      const recent = schemas.find(
        (t: any) => t.function.name === "get_recent_expenses",
      );
      expect(recent.function.parameters.properties.category.enum).toEqual([
        "Food",
        "Transport",
      ]);
    });

    it("omits the category param entirely when the user has no categories", async () => {
      tools.getCategories.mockResolvedValue({ categories: [] });
      create.mockResolvedValueOnce(text("ok"));
      await agent.answer("q", ctx);

      const schemas = create.mock.calls[0]![0].tools;
      const recent = schemas.find(
        (t: any) => t.function.name === "get_recent_expenses",
      );
      expect(recent.function.parameters.properties.category).toBeUndefined();
    });
  });

  describe("failures come back as data, not exceptions", () => {
    it("rejects an unknown category with the valid list so the model can retry", async () => {
      create
        .mockResolvedValueOnce(
          toolCall("get_recent_expenses", { category: "Groceries" }),
        )
        .mockResolvedValueOnce(text("done"));

      await agent.answer("spend on groceries?", ctx);

      expect(toolResultAt(1)).toMatchObject({
        ok: false,
        error: "unknown_category",
        available_categories: ["Food", "Transport"],
      });
      // The bad filter never reached the data layer — a silent [] would have
      // been reported to the user as "you spent nothing on groceries".
      expect(tools.getRecentExpenses).not.toHaveBeenCalled();
    });

    it("converts a thrown tool error into a soft error instead of killing the turn", async () => {
      tools.getPeriodStatus.mockRejectedValue(new Error("db is down"));
      create
        .mockResolvedValueOnce(toolCall("get_period_status", {}))
        .mockResolvedValueOnce(text("recovered"));

      await expect(agent.answer("status?", ctx)).resolves.toBe("recovered");
      expect(toolResultAt(1)).toMatchObject({
        ok: false,
        error: "tool_failed",
      });
    });

    it("does not leak internal error detail to the model", async () => {
      // The message is sent to the provider AND persisted in the turn's
      // toolCalls. Internal throws carry the user's internal id
      // ("FinancialDataTools: user <cuid> not found") or, for a Prisma
      // connection failure, the database host and username.
      tools.getPeriodStatus.mockRejectedValue(
        new Error("Can't reach database server at db-prod.internal:5432"),
      );
      create
        .mockResolvedValueOnce(toolCall("get_period_status", {}))
        .mockResolvedValueOnce(text("sorry"));

      await agent.answer("status?", ctx);
      const result = toolResultAt(1);

      expect(JSON.stringify(result)).not.toContain("db-prod.internal");
      expect(JSON.stringify(result)).not.toContain("5432");
    });

    it("reports an unknown tool name rather than silently returning nothing", async () => {
      create
        .mockResolvedValueOnce(toolCall("get_crypto_prices", {}))
        .mockResolvedValueOnce(text("done"));

      await agent.answer("btc?", ctx);
      expect(toolResultAt(1)).toMatchObject({
        ok: false,
        error: "unknown_tool",
      });
    });

    it("rejects a non-positive affordability amount", async () => {
      create
        .mockResolvedValueOnce(toolCall("check_affordability", { amount: 0 }))
        .mockResolvedValueOnce(text("done"));

      await agent.answer("can i afford it?", ctx);
      expect(toolResultAt(1)).toMatchObject({ error: "invalid_amount" });
      expect(tools.checkAffordability).not.toHaveBeenCalled();
    });

    it("handles malformed tool arguments", async () => {
      create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "get_period_status",
                      arguments: "{not json",
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce(text("done"));

      await agent.answer("status?", ctx);
      expect(toolResultAt(1)).toMatchObject({ error: "invalid_arguments" });
    });
  });

  it("passes a valid category through to the data layer", async () => {
    create
      .mockResolvedValueOnce(
        toolCall("get_recent_expenses", { category: "Food", limit: 3 }),
      )
      .mockResolvedValueOnce(text("done"));

    await agent.answer("last food spends", ctx);
    expect(tools.getRecentExpenses).toHaveBeenCalledWith("u1", {
      limit: 3,
      category: "Food",
      range: undefined,
    });
  });

  it("binds userId server-side even if the model supplies one", async () => {
    create
      .mockResolvedValueOnce(
        toolCall("get_period_status", { userId: "someone-else" }),
      )
      .mockResolvedValueOnce(text("done"));

    await agent.answer("status?", ctx);
    expect(tools.getPeriodStatus).toHaveBeenCalledWith("u1");
  });

  it("gives up after MAX_ROUNDS of tool calls instead of looping forever", async () => {
    create.mockResolvedValue(toolCall("get_period_status", {}));
    await expect(agent.answer("status?", ctx)).rejects.toThrow(
      /exceeded tool-call rounds/,
    );
    expect(create).toHaveBeenCalledTimes(5);
  });

  it("declines investment advice and points to a SEBI-registered adviser", async () => {
    create.mockResolvedValueOnce(text("ok"));
    await agent.answer("q", ctx);

    const system = create.mock.calls[0]![0].messages[0].content;
    expect(system).toContain("SEBI-registered investment adviser");
  });

  it("puts today's date and the cycle window in the system prompt", async () => {
    create.mockResolvedValueOnce(text("ok"));
    await agent.answer("q", ctx);

    const system = create.mock.calls[0]![0].messages[0].content;
    expect(system).toContain("Today: 2026-08-11");
    expect(system).toContain("2026-08-01 to 2026-08-31");
  });
});
