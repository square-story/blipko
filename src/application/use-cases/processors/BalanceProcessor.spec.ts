import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BalanceProcessor } from "./BalanceProcessor";

const NOW = new Date("2026-11-17T06:30:00Z");
const ANCHOR_AT = new Date("2026-11-10T06:30:00Z");

describe("BalanceProcessor", () => {
  let deps: any;
  let pending: any;
  let messageService: any;
  let processor: BalanceProcessor;
  let user: any;

  const ctx = (textMessage: string, extra: Record<string, unknown> = {}) =>
    ({
      user,
      platformUserId: "tg1",
      textMessage,
      callbackMessageId: "m1",
      ...extra,
    }) as any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    user = {
      id: "u1",
      timezone: "Asia/Kolkata",
      balanceAnchor: "10000.00",
      balanceAnchorAt: ANCHOR_AT,
    };
    deps = {
      userRepository: { update: vi.fn().mockResolvedValue({}) },
      incomeRepository: {
        sumForMonth: vi.fn().mockResolvedValue(0),
        sumCarryForMonth: vi.fn().mockResolvedValue(0),
      },
      // ₹50 of chai logged since the anchor → expected ₹9,950.
      expenseRepository: {
        sumByBucketForMonth: vi.fn(async (_u: string, b: string) =>
          b === "WANTS" ? 50 : 0,
        ),
        sumByCategoryForMonth: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "e1" }),
      },
      categoryRepository: {
        findByNameForUser: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "untracked" }),
      },
      boxRepository: { sumLinkedOutSince: vi.fn().mockResolvedValue(0) },
      incomeCategoryRepository: {},
    };
    pending = {
      create: vi.fn().mockResolvedValue({ id: "pa1" }),
      findLiveForUser: vi.fn(),
      consume: vi.fn().mockResolvedValue(true),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m2"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
      editInteractiveMessage: vi.fn().mockResolvedValue(undefined),
    };
    processor = new BalanceProcessor(deps, pending, messageService);
  });

  afterEach(() => vi.useRealTimers());

  const sent = () =>
    messageService.sendMessage.mock.calls[0]?.[0].body ??
    messageService.sendInteractiveMessage.mock.calls[0]?.[1];

  it("claims balance messages and bal: taps only", () => {
    expect(processor.canHandle(ctx("balance 9000"))).toBe(true);
    expect(processor.canHandle(ctx("/balance"))).toBe(true);
    expect(processor.canHandle(ctx("bal:pa1:y"))).toBe(true);
    expect(processor.canHandle(ctx("balance sheet review"))).toBe(false);
    expect(processor.canHandle(ctx("chai 30"))).toBe(false);
  });

  it("leaves a reply to a transaction to the reply processors", () => {
    expect(
      processor.canHandle(ctx("balance 9000", { replyTarget: { id: "e1" } })),
    ).toBe(false);
  });

  it("saves the first balance as the anchor", async () => {
    user.balanceAnchor = null;
    user.balanceAnchorAt = null;
    await processor.process(ctx("balance 12400"));
    expect(deps.userRepository.update).toHaveBeenCalledWith("u1", {
      balanceAnchor: 12400,
      balanceAnchorAt: NOW,
    });
    expect(sent()).toContain("✅ Balance saved: ₹12,400");
  });

  it("says all accounted for when the figures agree, and re-anchors", async () => {
    await processor.process(ctx("balance 9950"));
    expect(sent()).toContain("🔍 Balance check since 10 Nov");
    expect(sent()).toContain("Started ₹10,000 · income +₹0 · spent −₹50");
    expect(sent()).toContain("Expected ₹9,950 · you have ₹9,950");
    expect(sent()).toContain("✅ All accounted for.");
    expect(deps.userRepository.update).toHaveBeenCalledWith("u1", {
      balanceAnchor: 9950,
      balanceAnchorAt: NOW,
    });
    expect(pending.create).not.toHaveBeenCalled();
  });

  it("offers to log an unaccounted gap as Untracked", async () => {
    await processor.process(ctx("balance 9500"));
    expect(pending.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        kind: "BALANCE_GAP",
        payload: {
          amount: 450,
          at: NOW.toISOString(),
          since: ANCHOR_AT.toISOString(),
        },
        ttlMinutes: 24 * 60,
      }),
    );
    const [to, body, rows] =
      messageService.sendInteractiveMessage.mock.calls[0];
    expect(to).toBe("tg1");
    expect(body).toContain(
      "₹450 isn't accounted for — usually small cash or UPI spends that never got logged.",
    );
    expect(rows).toEqual([
      [
        { id: "bal:pa1:y", title: "Log ₹450 as Untracked" },
        { id: "bal:pa1:n", title: "Skip" },
      ],
    ]);
    expect(deps.userRepository.update).toHaveBeenCalledWith("u1", {
      balanceAnchor: 9500,
      balanceAnchorAt: NOW,
    });
  });

  it("points at unlogged income when there is more than expected", async () => {
    await processor.process(ctx("balance 11000"));
    expect(sent()).toContain(
      "You have ₹1,050 more than expected — probably income or a refund that wasn't logged.",
    );
    expect(pending.create).not.toHaveBeenCalled();
  });

  it("answers a bare /balance with the expected figure, without re-anchoring", async () => {
    await processor.process(ctx("/balance"));
    expect(sent()).toContain("Expected now: ₹9,950");
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it("explains how to start when no balance is saved", async () => {
    user.balanceAnchor = null;
    user.balanceAnchorAt = null;
    await processor.process(ctx("/balance"));
    expect(sent()).toContain('like "balance 12400"');
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  describe("gap buttons", () => {
    const row = {
      id: "pa1",
      kind: "BALANCE_GAP",
      payload: {
        amount: 450,
        at: NOW.toISOString(),
        since: ANCHOR_AT.toISOString(),
      },
      summary: "🔍 Balance check since 10 Nov",
    };

    it("logs the gap just before the new anchor so the next check skips it", async () => {
      pending.findLiveForUser.mockResolvedValue(row);
      const out = await processor.process(ctx("bal:pa1:y"));
      expect(pending.findLiveForUser).toHaveBeenCalledWith("pa1", "u1");
      expect(pending.consume).toHaveBeenCalledWith("pa1", "u1");
      expect(deps.categoryRepository.create).toHaveBeenCalledWith({
        userId: "u1",
        name: "Untracked",
        bucket: "WANTS",
      });
      const exp = deps.expenseRepository.create.mock.calls[0][0];
      expect(exp).toMatchObject({
        userId: "u1",
        amount: 450,
        bucket: "WANTS",
        categoryId: "untracked",
        confidence: 1,
      });
      expect(exp.rawText).toMatch(/^\[balance\] /);
      expect(exp.date.getTime()).toBeLessThan(NOW.getTime());
      expect(messageService.editInteractiveMessage).toHaveBeenCalledWith(
        "tg1",
        "m1",
        expect.stringContaining("🔍 Balance check since 10 Nov"),
        [],
      );
      expect(out.toast).toBe("Logged ₹450 as Untracked");
    });

    it("writes once on a double tap", async () => {
      pending.findLiveForUser.mockResolvedValue(row);
      pending.consume.mockResolvedValue(false);
      const out = await processor.process(ctx("bal:pa1:y"));
      expect(deps.expenseRepository.create).not.toHaveBeenCalled();
      expect(out.toast).toBe("Already done");
    });

    it("writes nothing for an expired or someone else's button", async () => {
      pending.findLiveForUser.mockResolvedValue(null);
      const out = await processor.process(ctx("bal:pa1:y"));
      expect(pending.consume).not.toHaveBeenCalled();
      expect(deps.expenseRepository.create).not.toHaveBeenCalled();
      expect(out.toast).toContain("expired");
    });

    it("skips without writing", async () => {
      pending.findLiveForUser.mockResolvedValue(row);
      const out = await processor.process(ctx("bal:pa1:n"));
      expect(pending.consume).toHaveBeenCalledWith("pa1", "u1");
      expect(deps.expenseRepository.create).not.toHaveBeenCalled();
      expect(messageService.editInteractiveMessage).toHaveBeenCalled();
      expect(out.toast).toBe("Skipped");
    });
  });
});
