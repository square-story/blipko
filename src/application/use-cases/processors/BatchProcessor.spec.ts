import { describe, it, expect, vi, beforeEach } from "vitest";
import { BatchProcessor } from "./BatchProcessor";

const user = {
  id: "u1",
  telegramId: "123",
  payday: 1,
  monthlyIncome: 50000,
  currency: "INR",
  locale: "en-IN",
};

describe("BatchProcessor", () => {
  let expenseRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let parseLogRepository: any;
  let incomeRepository: any;
  let messageService: any;
  let processor: BatchProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    expenseRepository = {
      create: vi.fn().mockImplementation(async () => ({ id: `e${++n}` })),
      updateConfirmationMessageId: vi.fn().mockResolvedValue(undefined),
      sumByBucketForMonth: vi.fn().mockResolvedValue(0),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "c1", name: "General" }),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    parseLogRepository = {
      create: vi.fn().mockResolvedValue({ id: "log1" }),
    };
    incomeRepository = {
      create: vi.fn().mockResolvedValue({ id: "inc1" }),
      sumForMonth: vi.fn().mockResolvedValue(50000),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("summary-msg"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("followup-msg"),
    };
    processor = new BatchProcessor(
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      parseLogRepository,
      incomeRepository,
      messageService,
    );
  });

  it("only handles a batch of 2 or more transactions", () => {
    expect(
      processor.canHandle({
        parsedBatch: { transactions: [{ intent: "EXPENSE", confidence: 0.9 }] },
      } as any),
    ).toBe(false);
    expect(
      processor.canHandle({
        parsedBatch: {
          transactions: [
            { intent: "EXPENSE", confidence: 0.9 },
            { intent: "EXPENSE", confidence: 0.9 },
          ],
        },
      } as any),
    ).toBe(true);
  });

  it("records confident expenses + income under one batchId, one summary", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30, auto 80, salary 50k",
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 30,
            category: "Food",
            bucket: "WANTS",
            note: "chai",
            confidence: 0.9,
          },
          {
            intent: "EXPENSE",
            amount: 80,
            category: "Transport",
            bucket: "NEEDS",
            note: "auto",
            confidence: 0.9,
          },
          { intent: "INCOME", amount: 50000, note: "salary", confidence: 0.9 },
        ],
      },
    } as any);

    expect(expenseRepository.create).toHaveBeenCalledTimes(2);
    expect(incomeRepository.create).toHaveBeenCalledTimes(1);

    // Same batchId on every write.
    const batchIds = [
      ...expenseRepository.create.mock.calls.map((c: any[]) => c[0].batchId),
      incomeRepository.create.mock.calls[0][0].batchId,
    ];
    expect(new Set(batchIds).size).toBe(1);
    expect(batchIds[0]).toBeTruthy();

    // Exactly one summary, no ambiguity follow-up.
    expect(messageService.sendMessage).toHaveBeenCalledTimes(1);
    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();

    // Each recorded expense item carries a compact bucket sub-line.
    const summary = messageService.sendMessage.mock.calls[0][0].body;
    expect(summary).toContain("· Wants:");
    expect(summary).toContain("· Needs:");
    expect(summary).toContain("left");

    // Representative row linked to the summary message.
    expect(expenseRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "e1",
      "summary-msg",
    );
  });

  it("stages ambiguous expenses and asks in one grouped follow-up", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30, paid 1500, cab 800",
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 30,
            category: "Food",
            bucket: "WANTS",
            note: "chai",
            confidence: 0.9,
          },
          { intent: "EXPENSE", amount: 1500, note: "paid", confidence: 0.3 },
          { intent: "EXPENSE", amount: 800, note: "cab", confidence: 0.4 },
        ],
      },
    } as any);

    // One confident expense recorded, two staged as ParseLog.
    expect(expenseRepository.create).toHaveBeenCalledTimes(1);
    expect(parseLogRepository.create).toHaveBeenCalledTimes(2);

    // ParseLog carries the batchId so confirmed items rejoin the batch.
    expect(parseLogRepository.create.mock.calls[0][0].batchId).toBeTruthy();

    // One summary + one grouped follow-up with a bkt: button row per item.
    expect(messageService.sendMessage).toHaveBeenCalledTimes(1);
    expect(messageService.sendInteractiveMessage).toHaveBeenCalledTimes(1);
    const rows = messageService.sendInteractiveMessage.mock.calls[0][2];
    expect(rows).toHaveLength(2);
    expect(rows[0][0].id).toMatch(/^bkt:log1:NEEDS$/);
  });
});
