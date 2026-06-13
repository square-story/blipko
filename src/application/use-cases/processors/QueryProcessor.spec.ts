import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryProcessor } from "./QueryProcessor";

const user = {
  id: "u1",
  telegramId: "123",
  monthlyIncome: 50000,
  payday: 1,
  currency: "INR",
  locale: "en-IN",
};

describe("QueryProcessor", () => {
  let queryAgent: any;
  let messageService: any;
  let processor: QueryProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    queryAgent = { answer: vi.fn() };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    processor = new QueryProcessor(queryAgent, messageService);
  });

  it("handles only the QUERY intent", () => {
    expect(
      processor.canHandle({
        textMessage: "how much on food?",
        parsed: { intent: "QUERY", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        textMessage: "chai 30",
        parsed: { intent: "EXPENSE", confidence: 0.9 },
      } as any),
    ).toBe(false);
  });

  it("delegates to the agent and sends its answer", async () => {
    queryAgent.answer.mockResolvedValue("You spent ₹1,200 on food this cycle.");

    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "how much on food?",
      parsed: { intent: "QUERY", confidence: 0.9 },
      conversationHistory: [],
    } as any);

    expect(queryAgent.answer).toHaveBeenCalledWith(
      "how much on food?",
      expect.objectContaining({ userId: "u1", currency: "INR", payday: 1 }),
    );
    expect(messageService.sendMessage).toHaveBeenCalledWith({
      to: "123",
      body: "You spent ₹1,200 on food this cycle.",
    });
    expect(out.response).toBe("You spent ₹1,200 on food this cycle.");
    expect(out.parsed.intent).toBe("QUERY");
  });

  it("degrades to a friendly fallback when the agent throws", async () => {
    queryAgent.answer.mockRejectedValue(new Error("provider down"));

    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "can I afford a 5000 phone?",
      parsed: { intent: "QUERY", confidence: 0.9 },
    } as any);

    expect(out.response).toContain("/status");
    expect(messageService.sendMessage).toHaveBeenCalledWith({
      to: "123",
      body: out.response,
    });
  });
});
