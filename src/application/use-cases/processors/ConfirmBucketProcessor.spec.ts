import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmBucketProcessor } from "./ConfirmBucketProcessor";

const user = {
  id: "u1",
  telegramId: "123",
  payday: 1,
  monthlyIncome: 10000,
  currency: "INR",
  locale: "en-IN",
};

describe("ConfirmBucketProcessor", () => {
  let parseLogRepository: any;
  let expenseRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let incomeRepository: any;
  let messageService: any;
  let processor: ConfirmBucketProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    parseLogRepository = {
      findById: vi.fn().mockResolvedValue({
        id: "log1",
        rawText: "chai 30",
        parsed: { amount: 30, category: "chai", confidence: 0.4 },
      }),
    };
    expenseRepository = {
      create: vi.fn().mockResolvedValue({ id: "e1", categoryId: "c1" }),
      spendByCategoryForMonth: vi
        .fn()
        .mockResolvedValue([{ categoryId: "c1", bucket: "WANTS", total: 30 }]),
      updateConfirmationMessageId: vi.fn().mockResolvedValue(undefined),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      findById: vi
        .fn()
        .mockResolvedValue({ id: "c1", name: "chai", monthlyBudget: 1000 }),
      create: vi.fn().mockResolvedValue({ id: "c1", name: "chai" }),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(0),
      receivedByCategoryForMonth: vi.fn().mockResolvedValue([]),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new ConfirmBucketProcessor(
      parseLogRepository,
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      incomeRepository,
      messageService,
    );
  });

  it("handles only bkt: callbacks", () => {
    expect(processor.canHandle({ textMessage: "bkt:log1:WANTS" } as any)).toBe(
      true,
    );
    expect(processor.canHandle({ textMessage: "chai 30" } as any)).toBe(false);
  });

  it("records the staged expense with the chosen bucket", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "bkt:log1:WANTS",
    } as any);

    expect(parseLogRepository.findById).toHaveBeenCalledWith("log1");
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 30,
        bucket: "WANTS",
        parseLogId: "log1",
      }),
    );
    // Per-category budget line is included (chai has a ₹1,000 cap, ₹30 spent).
    const body = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(body).toContain("chai:");
    expect(body).toContain("left of");
  });

  it("threads the batchId from the staged parse into the expense", async () => {
    parseLogRepository.findById.mockResolvedValue({
      id: "log1",
      rawText: "chai 30",
      batchId: "b1",
      parsed: { amount: 30, category: "chai", confidence: 0.4 },
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "bkt:log1:WANTS",
    } as any);

    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "b1" }),
    );
  });

  it("fails gracefully when the staged parse is gone", async () => {
    parseLogRepository.findById.mockResolvedValue(null);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "bkt:log1:WANTS",
    } as any);

    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "expired",
    );
  });
});
