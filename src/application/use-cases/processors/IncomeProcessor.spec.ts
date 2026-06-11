import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncomeProcessor } from "./IncomeProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

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
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
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
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Income ₹5,000");
    expect(body).toContain("This month: ₹55,000");
    expect(body).toContain("Needs ₹27,500"); // 55000 * 50%
    expect(body).toContain("Wants ₹16,500"); // 55000 * 30%
    expect(body).toContain("Savings ₹11,000"); // 55000 * 20%
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
