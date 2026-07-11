import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionActionProcessor } from "./TransactionActionProcessor";

const user = { id: "u1", telegramId: "123", payday: 1, monthlyIncome: 50000 };
const expenseRow = {
  id: "e1",
  userId: "u1",
  amount: 200,
  bucket: "WANTS",
  categoryId: "c1",
  note: "chai",
  batchId: null,
};

describe("TransactionActionProcessor", () => {
  let expenseRepository: any;
  let incomeRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let parseLogRepository: any;
  let messageService: any;
  let processor: TransactionActionProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    expenseRepository = {
      findById: vi.fn().mockResolvedValue(expenseRow),
      softDelete: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      sumByBucketForMonth: vi.fn().mockResolvedValue(0),
    };
    incomeRepository = { sumForMonth: vi.fn().mockResolvedValue(0) };
    categoryRepository = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: "c1", name: "Food", bucket: "WANTS" }),
      findByNameForUser: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "c2", name: "coffee" }),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    parseLogRepository = { findById: vi.fn().mockResolvedValue(null) };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
      editInteractiveMessage: vi.fn().mockResolvedValue(undefined),
    };
    processor = new TransactionActionProcessor(
      expenseRepository,
      incomeRepository,
      categoryRepository,
      budgetConfigRepository,
      parseLogRepository,
      messageService,
    );
  });

  it("handles only txn: callbacks", () => {
    expect(processor.canHandle({ textMessage: "txn:del:e:e1:y" } as any)).toBe(
      true,
    );
    expect(processor.canHandle({ textMessage: "bkt:log1:WANTS" } as any)).toBe(
      false,
    );
  });

  it("deletes on a confirmed delete and offers restore", async () => {
    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "txn:del:e:e1:y",
      callbackMessageId: "p1",
    } as any);

    expect(expenseRepository.softDelete).toHaveBeenCalledWith("e1");
    expect(out.toast).toBe("Deleted ✔");
    const [, , , rows] = messageService.editInteractiveMessage.mock.calls[0];
    expect(rows[0][0].id).toBe("txn:restore:e:e1");
  });

  it("keeps the entry when delete is declined", async () => {
    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "txn:del:e:e1:n",
      callbackMessageId: "p1",
    } as any);

    expect(expenseRepository.softDelete).not.toHaveBeenCalled();
    expect(out.toast).toBe("Kept");
  });

  it("applies a staged edit on confirm", async () => {
    parseLogRepository.findById.mockResolvedValue({
      id: "log1",
      parsed: {
        action: "txn-edit",
        kind: "expense",
        targetId: "e1",
        amount: 250,
      },
    });

    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "txn:edit:log1:y",
      callbackMessageId: "p1",
    } as any);

    expect(expenseRepository.update).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ amount: 250 }),
    );
    expect(out.toast).toBe("Updated ✔");
  });

  it("restores a soft-deleted entry", async () => {
    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "txn:restore:e:e1",
      callbackMessageId: "p1",
    } as any);

    expect(expenseRepository.restore).toHaveBeenCalledWith("e1");
    expect(out.toast).toBe("Restored ✔");
  });

  it("shows an expired notice when the staged edit is gone", async () => {
    parseLogRepository.findById.mockResolvedValue(null);

    const out = await processor.process({
      user,
      platformUserId: "123",
      textMessage: "txn:edit:log1:y",
      callbackMessageId: "p1",
    } as any);

    expect(expenseRepository.update).not.toHaveBeenCalled();
    expect(out.toast).toBe("Expired");
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "expired",
    );
  });
});
