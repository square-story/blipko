import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncomeProcessor } from "./IncomeProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

// Loaded once upstream (for the parser prompt) and handed down on the context.
const incomeCategories = [
  { id: "salary", name: "Salary", countsAsEarnings: true },
  { id: "other", name: "Other Income", countsAsEarnings: true },
  { id: "returned", name: "Money Lent Returned", countsAsEarnings: false },
];

describe("IncomeProcessor", () => {
  let incomeRepository: any;
  let budgetConfigRepository: any;
  let messageService: any;
  let processor: IncomeProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    incomeRepository = {
      create: vi.fn().mockResolvedValue({ id: "inc1" }),
      // After creating, this month's income totals 55,000 (50k salary + 5k freelance).
      sumForMonth: vi.fn().mockResolvedValue(55000),
      sumEarnedForMonth: vi.fn().mockResolvedValue(55000),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    incomeRepository.updateConfirmationMessageId = vi
      .fn()
      .mockResolvedValue(undefined);
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new IncomeProcessor(
      incomeRepository,
      budgetConfigRepository,
      messageService,
    );
  });

  it("handles the INCOME intent only", () => {
    expect(
      processor.canHandle({
        parsed: { intent: "INCOME", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        parsed: { intent: "EXPENSE", confidence: 0.9 },
      } as any),
    ).toBe(false);
  });

  it("records income and replies with the refreshed effective budget", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "got freelance 5000",
      parsed: {
        intent: "INCOME",
        amount: 5000,
        note: "freelance",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 5000,
        source: "freelance",
      }),
    );
    const body = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(body).toContain("Income ₹5,000");
    expect(body).toContain("Income this cycle: ₹55,000");
    expect(body).toContain("Budget on ₹55,000");
    expect(body).toContain("Needs ₹27,500"); // 55000 * 50%
    expect(body).toContain("Wants ₹16,500"); // 55000 * 30%
    expect(body).toContain("Savings ₹11,000"); // 55000 * 20%
    expect(incomeRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "inc1",
      "m2",
    );
  });

  // The bug this taxonomy exists for: a friend paying you back is not a raise.
  // The expense it offsets already consumed budget, so counting the return as
  // income would widen the budget on money that was already spent.
  it("files a refund under a non-earning category and says the budget is unchanged", async () => {
    const output = await processor.process({
      user: { id: "u1", monthlyIncome: 40000, payday: 1 },
      incomeCategories,
      platformUserId: "123",
      textMessage: "1500 from nadha, he returned the money",
      parsed: {
        intent: "INCOME",
        amount: 1500,
        category: "Money Lent Returned",
        note: "return from nadha",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create.mock.calls[0]![0].categoryId).toBe(
      "returned",
    );
    expect(output.response).toContain("Money coming back, not new income");
  });

  it("does not say that for real earnings", async () => {
    const output = await processor.process({
      user: { id: "u1", monthlyIncome: 40000, payday: 1 },
      incomeCategories,
      platformUserId: "123",
      textMessage: "got salary 40000",
      parsed: {
        intent: "INCOME",
        amount: 40000,
        category: "Salary",
        note: "salary",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create.mock.calls[0]![0].categoryId).toBe("salary");
    expect(output.response).not.toContain("Money coming back");
  });

  // An unknown name must not throw or write a dangling id — it lands on the
  // fallback, which counts as earnings, i.e. the pre-taxonomy behaviour.
  it("falls back to Other Income when the parser invents a category", async () => {
    await processor.process({
      user: { id: "u1", monthlyIncome: 40000, payday: 1 },
      incomeCategories,
      platformUserId: "123",
      textMessage: "got 500 from somewhere",
      parsed: {
        intent: "INCOME",
        amount: 500,
        category: "Crypto Airdrop",
        confidence: 0.7,
      },
    } as any);

    expect(incomeRepository.create.mock.calls[0]![0].categoryId).toBe("other");
  });

  it("asks again when the amount is missing", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "got paid",
      parsed: { intent: "INCOME", confidence: 0.4 },
    } as any);

    expect(incomeRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "couldn't catch the income amount",
    );
  });
});
