import { describe, it, expect, vi, beforeEach } from "vitest";
import { UndoProcessor } from "./UndoProcessor";

const user = { id: "u1", telegramId: "123", payday: 1, monthlyIncome: 50000 };
const lastExpense = {
  id: "e1",
  amount: 220,
  bucket: "WANTS",
  categoryId: "c1",
  note: "lunch",
  batchId: null,
  date: new Date(),
};

// UndoProcessor now CONFIRMS instead of deleting: it sends a Yes/No prompt whose
// buttons carry the shared txn:del/txn:delbatch callbacks. The actual delete is
// covered by TransactionActionProcessor.spec.
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
      softDelete: vi.fn().mockResolvedValue(undefined),
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
    incomeRepository = {
      findLastByUserId: vi.fn().mockResolvedValue(null),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new UndoProcessor(
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      incomeRepository as any,
      messageService,
    );
  });

  it("matches 'undo'/'/undo' and the UNDO intent, but not replies", () => {
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
    // A reply to a transaction is handled by TransactionReplyProcessor.
    expect(
      processor.canHandle({
        ...base,
        textMessage: "undo",
        replyTarget: { kind: "expense", row: lastExpense },
      } as any),
    ).toBe(false);
    expect(
      processor.canHandle({ ...base, textMessage: "lunch 30" } as any),
    ).toBe(false);
  });

  it("confirms before removing the latest expense (does not delete)", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    // No deletion yet — only a confirmation prompt.
    expect(expenseRepository.softDelete).not.toHaveBeenCalled();
    const [, body, rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("Undo this?");
    expect(body).toContain("Food");
    // The Yes button carries the shared delete callback for this expense.
    expect(rows[0][0].id).toBe("txn:del:e:e1:y");
    expect(rows[0][1].id).toBe("txn:del:e:e1:n");
  });

  it("uses the batch delete callback when the latest entry is batched", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue({
      ...lastExpense,
      batchId: "b1",
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    const rows = messageService.sendInteractiveMessage.mock.calls[0][2];
    expect(rows[0][0].id).toBe("txn:delbatch:b1:y");
  });

  it("confirms the latest income when it is the most recent entry", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue(null);
    incomeRepository.findLastByUserId.mockResolvedValue({
      id: "i9",
      amount: 5000,
      note: "freelance",
      date: new Date(),
      batchId: null,
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    const rows = messageService.sendInteractiveMessage.mock.calls[0][2];
    expect(rows[0][0].id).toBe("txn:del:i:i9:y");
  });

  it("says there is nothing to undo when no entry exists", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue(null);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "undo",
    } as any);

    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Nothing to undo",
    );
  });
});
