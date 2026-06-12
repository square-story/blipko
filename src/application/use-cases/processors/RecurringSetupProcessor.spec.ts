import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecurringSetupProcessor } from "./RecurringSetupProcessor";

const user = { id: "u1", telegramId: "123" };

describe("RecurringSetupProcessor", () => {
  let recurringRuleRepository: any;
  let categoryRepository: any;
  let messageService: any;
  let processor: RecurringSetupProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Fix "today" to the 15th so day 1 is in the past and day 25 is in the future.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    recurringRuleRepository = {
      create: vi.fn().mockResolvedValue({ id: "rr1" }),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({ id: "c1", name: "Rent", bucket: "NEEDS" }),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new RecurringSetupProcessor(
      recurringRuleRepository,
      categoryRepository,
      messageService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("creates a recurring expense and prompts for the current month when the day passed", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "rent 8000 on 1st every month",
      parsed: {
        intent: "RECURRING",
        recurringKind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1, // already passed (today = 15th)
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
    const [, body, buttons] =
      messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("Recurring set");
    expect(body).toContain("add it for this month");
    expect(buttons.map((b: any) => b.id)).toEqual([
      "rec:rr1:yes",
      "rec:rr1:no",
    ]);
  });

  it("creates a recurring income with no prompt when the day is still ahead", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "salary 50000 on 25th monthly",
      parsed: {
        intent: "RECURRING",
        recurringKind: "INCOME",
        amount: 50000,
        dayOfMonth: 25, // still ahead (today = 15th)
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
    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
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
