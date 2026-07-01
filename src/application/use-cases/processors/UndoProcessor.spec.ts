import { describe, it, expect, vi, beforeEach } from "vitest";
import { UndoProcessor } from "./UndoProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };
const lastExpense = {
  id: "e1",
  amount: 220,
  bucket: "WANTS",
  categoryId: "c1",
  note: "lunch",
};

describe("UndoProcessor", () => {
  let expenseRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let incomeRepository: any;
  let messageService: any;
  let processor: UndoProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    expenseRepository = {
      findLastByUserId: vi.fn().mockResolvedValue(lastExpense),
      findByConfirmationMessageId: vi.fn().mockResolvedValue(null),
      softDelete: vi.fn().mockResolvedValue(undefined),
      findByBatchId: vi.fn().mockResolvedValue([]),
      softDeleteByBatchId: vi.fn().mockResolvedValue(undefined),
      sumByBucketForMonth: vi.fn().mockResolvedValue(0), // after delete
    };
    categoryRepository = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: "c1", name: "Food", bucket: "WANTS" }),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(0),
      findLastByUserId: vi.fn().mockResolvedValue(null),
      findByBatchId: vi.fn().mockResolvedValue([]),
      softDeleteByBatchId: vi.fn().mockResolvedValue(undefined),
    };
    processor = new UndoProcessor(
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      incomeRepository as any,
      messageService,
    );
  });

  it("matches 'undo'/'/undo' and the UNDO intent", () => {
    const base = { user, platformUserId: "123" };
    expect(processor.canHandle({ ...base, textMessage: "undo" } as any)).toBe(
      true,
    );
    expect(processor.canHandle({ ...base, textMessage: "/undo" } as any)).toBe(
      true,
    );
    expect(
      processor.canHandle({
        ...base,
        textMessage: "delete that",
        parsed: { intent: "UNDO", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({ ...base, textMessage: "lunch 30" } as any),
    ).toBe(false);
  });

  it("removes the last expense and shows restored budget", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    expect(expenseRepository.softDelete).toHaveBeenCalledWith("e1");
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Removed: ₹220 Food");
    expect(body).toContain("Wants left this month: ₹15,000");
  });

  it("targets the replied-to expense when a confirmation reply is undone", async () => {
    expenseRepository.findByConfirmationMessageId.mockResolvedValue({
      ...lastExpense,
      id: "e9",
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
      replyToMessageId: "msg-9",
    } as any);

    expect(expenseRepository.findByConfirmationMessageId).toHaveBeenCalledWith(
      "msg-9",
      "u1",
    );
    expect(expenseRepository.softDelete).toHaveBeenCalledWith("e9");
  });

  it("undoes the whole batch when the last entry has a batchId", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue({
      ...lastExpense,
      batchId: "b1",
    });
    expenseRepository.findByBatchId.mockResolvedValue([
      { id: "e1", amount: 30, bucket: "WANTS" },
      { id: "e2", amount: 80, bucket: "NEEDS" },
    ]);
    incomeRepository.findByBatchId.mockResolvedValue([
      { id: "i1", amount: 50000 },
    ]);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    expect(expenseRepository.softDeleteByBatchId).toHaveBeenCalledWith(
      "b1",
      "u1",
    );
    expect(incomeRepository.softDeleteByBatchId).toHaveBeenCalledWith(
      "b1",
      "u1",
    );
    expect(expenseRepository.softDelete).not.toHaveBeenCalled();
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Removed 3 entries");
  });

  it("undoes a single income when it is the most recent entry", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue(null);
    incomeRepository.findLastByUserId.mockResolvedValue({
      id: "i9",
      amount: 5000,
      note: "freelance",
      date: new Date(),
      batchId: null,
    });
    incomeRepository.softDelete = vi.fn().mockResolvedValue(undefined);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    expect(incomeRepository.softDelete).toHaveBeenCalledWith("i9");
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Removed income: ₹5,000",
    );
  });

  it("says there is nothing to undo when no expense exists", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue(null);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    expect(expenseRepository.softDelete).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Nothing to undo",
    );
  });
});
