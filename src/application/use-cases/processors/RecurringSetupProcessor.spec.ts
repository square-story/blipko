import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecurringSetupProcessor } from "./RecurringSetupProcessor";

const user = { id: "u1", telegramId: "123" };

describe("RecurringSetupProcessor", () => {
  let recurringRuleRepository: any;
  let categoryRepository: any;
  let messageService: any;
  let processor: RecurringSetupProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    recurringRuleRepository = {
      create: vi.fn().mockResolvedValue({ id: "rr1" }),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({ id: "c1", name: "Rent", bucket: "NEEDS" }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    processor = new RecurringSetupProcessor(
      recurringRuleRepository,
      categoryRepository,
      messageService,
    );
  });

  it("handles only the RECURRING intent", () => {
    expect(
      processor.canHandle({
        parsed: { intent: "RECURRING", confidence: 1 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        parsed: { intent: "EXPENSE", confidence: 1 },
      } as any),
    ).toBe(false);
  });

  it("creates a recurring expense with resolved category + bucket", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "rent 8000 on 1st every month",
      parsed: {
        intent: "RECURRING",
        recurringKind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1,
        category: "Rent",
        bucket: "NEEDS",
        note: "rent",
        confidence: 0.9,
      },
    } as any);

    expect(recurringRuleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        kind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1,
        bucket: "NEEDS",
        categoryId: "c1",
      }),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Recurring set",
    );
  });

  it("creates a recurring income", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "salary 50000 on 25th monthly",
      parsed: {
        intent: "RECURRING",
        recurringKind: "INCOME",
        amount: 50000,
        dayOfMonth: 25,
        note: "salary",
        confidence: 0.9,
      },
    } as any);

    expect(recurringRuleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "INCOME",
        amount: 50000,
        dayOfMonth: 25,
      }),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Recurring income",
    );
  });

  it("asks for a day when dayOfMonth is missing", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "rent 8000 monthly",
      parsed: {
        intent: "RECURRING",
        recurringKind: "EXPENSE",
        amount: 8000,
        confidence: 0.9,
      },
    } as any);

    expect(recurringRuleRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain("day");
  });
});
