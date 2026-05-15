import { describe, it, expect, vi, beforeEach } from "vitest";
import { DuePaymentProcessor } from "./DuePaymentProcessor";

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "due-1",
  chargeId: "charge-1",
  amount: 500,
  charge: { userId: "user-correct" },
  ...overrides,
});

const makeContext = (msg: string, userId = "user-correct") => ({
  textMessage: msg,
  platformUserId: "tg-123",
  user: { id: userId, name: "Alice", telegramId: "tg-123" },
  parsed: null,
});

describe("DuePaymentProcessor", () => {
  let dueRepo: any;
  let messageSvc: any;
  let processor: DuePaymentProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    dueRepo = {
      findById: vi.fn(),
      markPaid: vi.fn().mockResolvedValue(undefined),
      snooze: vi.fn().mockResolvedValue(undefined),
    };
    messageSvc = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    processor = new DuePaymentProcessor(dueRepo, messageSvc);
  });

  describe("canHandle", () => {
    it("handles mark_paid_ prefix", () => {
      expect(processor.canHandle(makeContext("mark_paid_abc") as any)).toBe(true);
    });
    it("handles snooze_ prefix", () => {
      expect(processor.canHandle(makeContext("snooze_abc") as any)).toBe(true);
    });
    it("ignores other messages", () => {
      expect(processor.canHandle(makeContext("pay rent") as any)).toBe(false);
    });
  });

  describe("mark_paid", () => {
    it("marks paid for correct user", async () => {
      dueRepo.findById.mockResolvedValue(makeEntry());
      await processor.process(makeContext("mark_paid_due-1") as any);
      expect(dueRepo.markPaid).toHaveBeenCalledWith("due-1", 500);
      const msg = messageSvc.sendMessage.mock.calls[0][0].body;
      expect(msg).toContain("Marked as paid");
    });

    it("rejects mark_paid from wrong user", async () => {
      dueRepo.findById.mockResolvedValue(makeEntry({ charge: { userId: "user-correct" } }));
      const ctx = makeContext("mark_paid_due-1", "user-wrong");
      await processor.process(ctx as any);
      expect(dueRepo.markPaid).not.toHaveBeenCalled();
      const msg = messageSvc.sendMessage.mock.calls[0][0].body;
      expect(msg).toBe("Due entry not found.");
    });

    it("returns not found for unknown id", async () => {
      dueRepo.findById.mockResolvedValue(null);
      await processor.process(makeContext("mark_paid_no-such-id") as any);
      expect(dueRepo.markPaid).not.toHaveBeenCalled();
      const msg = messageSvc.sendMessage.mock.calls[0][0].body;
      expect(msg).toBe("Due entry not found.");
    });
  });

  describe("snooze", () => {
    it("snoozes for correct user", async () => {
      dueRepo.findById.mockResolvedValue(makeEntry());
      await processor.process(makeContext("snooze_due-1") as any);
      expect(dueRepo.snooze).toHaveBeenCalledWith("due-1", 3);
      const msg = messageSvc.sendMessage.mock.calls[0][0].body;
      expect(msg).toContain("Snoozed");
    });

    it("rejects snooze from wrong user", async () => {
      dueRepo.findById.mockResolvedValue(makeEntry());
      const ctx = makeContext("snooze_due-1", "user-wrong");
      await processor.process(ctx as any);
      expect(dueRepo.snooze).not.toHaveBeenCalled();
      const msg = messageSvc.sendMessage.mock.calls[0][0].body;
      expect(msg).toBe("Due entry not found.");
    });
  });
});
