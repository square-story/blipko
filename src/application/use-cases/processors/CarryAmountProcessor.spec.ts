import { describe, it, expect, vi, beforeEach } from "vitest";
import { CarryAmountProcessor } from "./CarryAmountProcessor";
import { periodKey } from "../budgetMath";

const user = { id: "u1", payday: 1, timezone: "UTC" } as any;
const KEY = periodKey(1, new Date(), "UTC");
const live = { id: "p1", kind: "CARRY_AMOUNT" } as any;

const ctx = (textMessage: string, carryPrompt: unknown = live) =>
  ({ user, platformUserId: "tg1", textMessage, carryPrompt }) as any;

describe("CarryAmountProcessor", () => {
  let pendingActionRepository: any;
  let messageService: any;
  let processor: CarryAmountProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    pendingActionRepository = { consume: vi.fn().mockResolvedValue(true) };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m1"),
    };
    processor = new CarryAmountProcessor(
      pendingActionRepository,
      messageService,
    );
  });

  it("claims a bare number only while a request is live", () => {
    expect(processor.canHandle(ctx("12700"))).toBe(true);
    expect(processor.canHandle(ctx("₹12,700"))).toBe(true);
    // No staged request → a lone number is an expense again.
    expect(processor.canHandle(ctx("12700", null))).toBe(false);
  });

  it("never claims a message that says anything else", () => {
    for (const text of ["chai 30", "500 for chai", "status", "", "-5"]) {
      expect(processor.canHandle(ctx(text))).toBe(false);
    }
  });

  it("consumes the request and asks where the money goes", async () => {
    await processor.process(ctx("12700"));
    expect(pendingActionRepository.consume).toHaveBeenCalledWith("p1", "u1");
    const [, , rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(rows[0][0].id).toBe(`car:${KEY}:s:12700`);
    expect(rows[0][1].id).toBe(`car:${KEY}:o:12700`);
  });

  it("offers nothing when another tap already consumed the request", async () => {
    pendingActionRepository.consume.mockResolvedValue(false);
    await processor.process(ctx("12700"));
    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
  });
});
