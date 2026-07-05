import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionReplyProcessor } from "./TransactionReplyProcessor";

const user = { id: "u1", telegramId: "123", payday: 1, monthlyIncome: 50000 };
const expenseRef = {
  kind: "expense" as const,
  row: {
    id: "e1",
    userId: "u1",
    amount: 200,
    bucket: "WANTS",
    categoryId: "c1",
    note: "chai",
    batchId: null,
  },
};

describe("TransactionReplyProcessor", () => {
  let expenseRepository: any;
  let incomeRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let parseLogRepository: any;
  let messageService: any;
  let processor: TransactionReplyProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    expenseRepository = {};
    incomeRepository = {};
    categoryRepository = {
      findById: vi.fn().mockResolvedValue({ id: "c1", name: "Food" }),
    };
    budgetConfigRepository = {};
    parseLogRepository = {
      create: vi.fn().mockResolvedValue({ id: "log1" }),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new TransactionReplyProcessor(
      expenseRepository,
      incomeRepository,
      categoryRepository,
      budgetConfigRepository,
      parseLogRepository,
      messageService,
    );
  });

  it("handles only replies to a resolved transaction", () => {
    expect(
      processor.canHandle({ textMessage: "x", replyTarget: expenseRef } as any),
    ).toBe(true);
    expect(processor.canHandle({ textMessage: "x" } as any)).toBe(false);
  });

  it("routes a delete-word reply to a delete confirmation", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "delete",
      parsed: { intent: "UNKNOWN", confidence: 0.5 },
      replyTarget: expenseRef,
      replyToMessageId: "m9",
    } as any);

    const [, body, rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("Delete this?");
    expect(rows[0][0].id).toBe("txn:del:e:e1:y");
    expect(parseLogRepository.create).not.toHaveBeenCalled();
  });

  it("stages an edit and asks to confirm before applying", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "250 coffee",
      parsed: {
        intent: "EXPENSE",
        amount: 250,
        category: "coffee",
        note: "coffee",
        confidence: 0.9,
      },
      replyTarget: expenseRef,
      replyToMessageId: "m9",
    } as any);

    const staged = parseLogRepository.create.mock.calls[0][0].parsed;
    expect(staged).toMatchObject({
      action: "txn-edit",
      kind: "expense",
      targetId: "e1",
      amount: 250,
      categoryName: "coffee",
    });
    const [, body, rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("Update this?");
    expect(rows[0][0].id).toBe("txn:edit:log1:y");
  });

  it("refuses to edit a batched entry", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "250",
      parsed: { intent: "EXPENSE", amount: 250, confidence: 0.9 },
      replyTarget: {
        kind: "expense",
        row: { ...expenseRef.row, batchId: "b1" },
      },
    } as any);

    expect(parseLogRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "multi-entry",
    );
  });

  it("nudges when the reply has neither a change nor a delete word", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "thanks",
      parsed: { intent: "UNKNOWN", confidence: 0.5 },
      replyTarget: expenseRef,
    } as any);

    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Reply with a new amount",
    );
  });
});
