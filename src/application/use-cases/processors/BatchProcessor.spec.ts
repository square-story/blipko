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

// Loaded once upstream (for the parser prompt) and handed down on the context.
const INCOME_CATEGORIES = [
  { id: "salary", name: "Salary", countsAsEarnings: true },
  { id: "other", name: "Other Income", countsAsEarnings: true },
  { id: "returned", name: "Money Lent Returned", countsAsEarnings: false },
];

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
      sumEarnedForMonth: vi.fn().mockResolvedValue(50000),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("summary-msg"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("summary-msg"),
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

    // Exactly one summary (interactive, with a delete-all button); no follow-up.
    expect(messageService.sendInteractiveMessage).toHaveBeenCalledTimes(1);

    // Each recorded expense item carries a compact bucket sub-line.
    const summary = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(summary).toContain("· Wants:");
    expect(summary).toContain("· Needs:");
    expect(summary).toContain("left");

    // Summary carries a Delete-all quick action.
    const summaryRows = messageService.sendInteractiveMessage.mock.calls[0][2];
    expect(summaryRows[0][0].id).toMatch(/^txn:askdelbatch:/);

    // Representative row linked to the summary message.
    expect(expenseRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "e1",
      "summary-msg",
    );
  });

  // The gap this closes: batch income used to be written with no category, and
  // an uncategorised row counts as earnings — so a refund buried in a
  // multi-transaction message widened the budget anyway.
  it("files batch income under a category, and marks money coming back", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30, nadha returned 1500",
      incomeCategories: INCOME_CATEGORIES,
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 30,
            category: "Eating Out",
            bucket: "WANTS",
            confidence: 0.9,
          },
          {
            intent: "INCOME",
            amount: 1500,
            category: "Money Lent Returned",
            note: "nadha",
            confidence: 0.9,
          },
        ],
      },
    } as any);

    expect(incomeRepository.create.mock.calls[0]![0].categoryId).toBe(
      "returned",
    );
    const summary = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(summary).toContain("↩️ Income ₹1,500");
  });

  it("falls back to Other Income for a batch item with no category", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30, got 500",
      incomeCategories: INCOME_CATEGORIES,
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 30,
            category: "Eating Out",
            bucket: "WANTS",
            confidence: 0.9,
          },
          { intent: "INCOME", amount: 500, confidence: 0.9 },
        ],
      },
    } as any);

    expect(incomeRepository.create.mock.calls[0]![0].categoryId).toBe("other");
    const summary = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(summary).toContain("✅ Income ₹500");
  });

  it("counts invented categories in one footer instead of per line", async () => {
    // "Food" exists; "Dosa" does not.
    categoryRepository.findByNameForUser.mockImplementation(
      async (_userId: string, name: string) =>
        name === "Food"
          ? { id: "cF", name: "Food", isGroup: false, bucket: "WANTS" }
          : null,
    );
    categoryRepository.create.mockResolvedValue({
      id: "c9",
      name: "Dosa",
      isGroup: false,
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "chai 30, dosa 60",
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 30,
            category: "Food",
            bucket: "WANTS",
            confidence: 0.9,
          },
          {
            intent: "EXPENSE",
            amount: 60,
            category: "Dosa",
            bucket: "WANTS",
            confidence: 0.9,
          },
        ],
      },
    } as any);

    const summary = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(categoryRepository.create).toHaveBeenCalledTimes(1);
    expect(summary).toContain("1 new category");
    expect(summary).not.toContain("new categories");
    // One footer, not one marker per logged line.
    expect(summary.match(/new categor/g)).toHaveLength(1);
  });

  it("pluralizes the new-category footer", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "dosa 60, idli 40",
      parsedBatch: {
        transactions: [
          {
            intent: "EXPENSE",
            amount: 60,
            category: "Dosa",
            bucket: "WANTS",
            confidence: 0.9,
          },
          {
            intent: "EXPENSE",
            amount: 40,
            category: "Idli",
            bucket: "WANTS",
            confidence: 0.9,
          },
        ],
      },
    } as any);

    expect(messageService.sendInteractiveMessage.mock.calls[0][1]).toContain(
      "2 new categories",
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

    // Summary (interactive) + one grouped follow-up with a bkt: button row per item.
    expect(messageService.sendInteractiveMessage).toHaveBeenCalledTimes(2);
    const rows = messageService.sendInteractiveMessage.mock.calls[1][2];
    expect(rows).toHaveLength(2);
    expect(rows[0][0].id).toMatch(/^bkt:log1:NEEDS$/);
  });
});
