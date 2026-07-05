import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpenseProcessor } from "./ExpenseProcessor";

const user = {
  id: "u1",
  telegramId: "123",
  payday: 1,
  monthlyIncome: 10000,
  currency: "INR",
  locale: "en-IN",
};

describe("ExpenseProcessor", () => {
  let expenseRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let parseLogRepository: any;
  let incomeRepository: any;
  let messageService: any;
  let processor: ExpenseProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    expenseRepository = {
      create: vi.fn().mockResolvedValue({ id: "e1" }),
      sumByBucketForMonth: vi.fn().mockResolvedValue(30),
      updateConfirmationMessageId: vi.fn().mockResolvedValue(undefined),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "c1", name: "chai" }),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    parseLogRepository = {
      create: vi.fn().mockResolvedValue({ id: "log1" }),
    };
    incomeRepository = { sumForMonth: vi.fn().mockResolvedValue(0) };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new ExpenseProcessor(
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      parseLogRepository,
      incomeRepository,
      messageService,
    );
  });

  it("handles the EXPENSE intent only", () => {
    expect(
      processor.canHandle({
        parsed: { intent: "EXPENSE", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        parsed: { intent: "INCOME", confidence: 0.9 },
      } as any),
    ).toBe(false);
  });

  it("records a confident expense and replies", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30",
      parsed: {
        intent: "EXPENSE",
        amount: 30,
        category: "chai",
        bucket: "WANTS",
        confidence: 0.9,
      },
    } as any);

    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 30, bucket: "WANTS" }),
    );
    // Confirmation now carries Edit/Delete quick-action buttons.
    expect(messageService.sendInteractiveMessage.mock.calls[0][1]).toContain(
      "₹30",
    );
    expect(expenseRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "e1",
      "m2",
    );
    expect(parseLogRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a NaN amount without writing anything", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai lots",
      parsed: {
        intent: "EXPENSE",
        amount: NaN,
        bucket: "WANTS",
        confidence: 0.9,
      },
    } as any);

    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "couldn't catch the amount",
    );
  });

  it("asks for a bucket on a low-confidence parse", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "spent 500 somewhere",
      parsed: {
        intent: "EXPENSE",
        amount: 500,
        bucket: "WANTS",
        confidence: 0.3,
      },
    } as any);

    expect(parseLogRepository.create).toHaveBeenCalled();
    expect(messageService.sendInteractiveMessage).toHaveBeenCalled();
    expect(expenseRepository.create).not.toHaveBeenCalled();
  });
});
