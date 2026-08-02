import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecurringCommandProcessor } from "./RecurringCommandProcessor";

describe("RecurringCommandProcessor", () => {
  let messageService: any;
  let recurringRuleRepository: any;
  let processor: RecurringCommandProcessor;

  const ctx = {
    platformUserId: "123",
    user: { id: "u1" },
    textMessage: "/recurring",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    recurringRuleRepository = { findByUserId: vi.fn().mockResolvedValue([]) };
    processor = new RecurringCommandProcessor(
      recurringRuleRepository,
      messageService,
    );
  });

  it("matches 'recurring' and '/recurring' only", () => {
    expect(processor.canHandle({ textMessage: "recurring" } as any)).toBe(true);
    expect(processor.canHandle({ textMessage: " /RECURRING " } as any)).toBe(
      true,
    );
    expect(
      processor.canHandle({ textMessage: "rent 12000 every month" } as any),
    ).toBe(false);
    expect(processor.canHandle({ textMessage: "chai 30" } as any)).toBe(false);
  });

  it("guides the user when they have no rules yet", async () => {
    await processor.process(ctx);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("no recurring rules yet");
    expect(body).toContain("every month");
  });

  it("lists active rules with amount, direction and day", async () => {
    recurringRuleRepository.findByUserId.mockResolvedValue([
      {
        kind: "EXPENSE",
        amount: 12000,
        dayOfMonth: 5,
        note: "Rent",
        isActive: true,
      },
      {
        kind: "INCOME",
        amount: 50000,
        dayOfMonth: 25,
        note: "Salary",
        isActive: true,
      },
    ]);

    const result = await processor.process(ctx);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Rent");
    expect(body).toContain("-₹12,000");
    expect(body).toContain("Day 5");
    expect(body).toContain("+₹50,000");
    expect(body).toContain("Day 25");
    expect(result.parsed?.intent).toBe("RECURRING");
  });

  it("hides paused rules", async () => {
    recurringRuleRepository.findByUserId.mockResolvedValue([
      {
        kind: "EXPENSE",
        amount: 999,
        dayOfMonth: 1,
        note: "Paused thing",
        isActive: false,
      },
    ]);

    await processor.process(ctx);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).not.toContain("Paused thing");
    expect(body).toContain("no recurring rules yet");
  });
});
