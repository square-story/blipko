import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecurringConfirmProcessor } from "./RecurringConfirmProcessor";

const expenseRule = {
  id: "rr1",
  userId: "u1",
  kind: "EXPENSE",
  amount: 8000,
  dayOfMonth: 1,
  bucket: "NEEDS",
  categoryId: "c1",
  note: "rent",
};

describe("RecurringConfirmProcessor", () => {
  let recurringRuleRepository: any;
  let expenseRepository: any;
  let incomeRepository: any;
  let categoryRepository: any;
  let messageService: any;
  let boxRepository: any;
  let processor: RecurringConfirmProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    recurringRuleRepository = {
      findById: vi.fn().mockResolvedValue(expenseRule),
      markPosted: vi.fn().mockResolvedValue(undefined),
    };
    expenseRepository = { create: vi.fn().mockResolvedValue({ id: "e1" }) };
    incomeRepository = { create: vi.fn().mockResolvedValue({ id: "i1" }) };
    categoryRepository = {
      findById: vi.fn().mockResolvedValue({ id: "c1", name: "Rent" }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    boxRepository = {
      findByIdForUser: vi.fn(),
      addEntry: vi.fn().mockResolvedValue({ id: "be1" }),
    };
    processor = new RecurringConfirmProcessor(
      recurringRuleRepository,
      expenseRepository,
      incomeRepository,
      categoryRepository,
      messageService,
      async (fn: any) => fn({}),
      boxRepository,
    );
  });

  it("matches only rec: callbacks", () => {
    expect(processor.canHandle({ textMessage: "rec:rr1:yes" } as any)).toBe(
      true,
    );
    expect(processor.canHandle({ textMessage: "lunch 30" } as any)).toBe(false);
  });

  it("yes → posts the rule for this month and marks it posted", async () => {
    await processor.process({
      platformUserId: "123",
      textMessage: "rec:rr1:yes",
    } as any);

    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 8000, bucket: "NEEDS" }),
      expect.anything(),
    );
    expect(recurringRuleRepository.markPosted).toHaveBeenCalledWith(
      "rr1",
      expect.any(String),
      expect.anything(),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Added for this month",
    );
  });

  it("no → marks posted without creating anything", async () => {
    await processor.process({
      platformUserId: "123",
      textMessage: "rec:rr1:no",
    } as any);

    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(incomeRepository.create).not.toHaveBeenCalled();
    expect(recurringRuleRepository.markPosted).toHaveBeenCalledWith(
      "rr1",
      expect.any(String),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "next month",
    );
  });

  it("handles an expired/missing rule gracefully", async () => {
    recurringRuleRepository.findById.mockResolvedValue(null);
    await processor.process({
      platformUserId: "123",
      textMessage: "rec:gone:yes",
    } as any);

    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "no longer set up",
    );
  });
});
