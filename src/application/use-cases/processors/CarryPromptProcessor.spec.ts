import { describe, it, expect, vi, beforeEach } from "vitest";
import { CarryPromptProcessor } from "./CarryPromptProcessor";
import { carryCb } from "../carryCallback";
import { periodKey } from "../budgetMath";

const user = {
  id: "u1",
  payday: 1,
  timezone: "UTC",
  carryDecidedKey: null,
} as any;

// The buttons always carry the CURRENT cycle, so the spec derives it the same
// way the processor does rather than pinning a date the suite would outlive.
const KEY = periodKey(1, new Date(), "UTC");

const ctx = (data: string, over: Record<string, unknown> = {}) =>
  ({
    user: { ...user, ...over },
    platformUserId: "tg1",
    textMessage: data,
  }) as any;

describe("CarryPromptProcessor", () => {
  let deps: any;
  let pendingActionRepository: any;
  let messageService: any;
  let processor: CarryPromptProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      userRepository: { claimCarryCycle: vi.fn().mockResolvedValue(true) },
      expenseRepository: {
        create: vi.fn().mockResolvedValue({ id: "e1" }),
        softDelete: vi.fn(),
      },
      incomeRepository: { create: vi.fn().mockResolvedValue({ id: "i1" }) },
      incomeCategoryRepository: {
        findAllForUser: vi
          .fn()
          .mockResolvedValue([{ id: "ic1", name: "Opening Balance" }]),
      },
      categoryRepository: {
        // Name matters: carryExpenseCategoryId accepts an EXACT hit only.
        findByNameForUser: vi
          .fn()
          .mockResolvedValue({ id: "c1", name: "Carried Forward" }),
        create: vi
          .fn()
          .mockResolvedValue({ id: "c1", name: "Carried Forward" }),
      },
      boxRepository: {
        listWithBalances: vi.fn().mockResolvedValue([]),
        findByIdForUser: vi
          .fn()
          .mockResolvedValue({ id: "b1", name: "Emergency", icon: null }),
        addEntry: vi.fn().mockResolvedValue({ id: "be1" }),
        balanceFor: vi.fn().mockResolvedValue(42000),
      },
    };
    pendingActionRepository = {
      create: vi.fn().mockResolvedValue({ id: "p1" }),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m1"),
    };
    processor = new CarryPromptProcessor(
      deps,
      pendingActionRepository,
      messageService,
    );
  });

  it("claims only car: callbacks it can parse", () => {
    expect(processor.canHandle(ctx(carryCb.skip(KEY)))).toBe(true);
    expect(processor.canHandle(ctx("car:garbage"))).toBe(false);
    expect(processor.canHandle(ctx("chai 30"))).toBe(false);
  });

  it("files an opening balance as carry-category income", async () => {
    await processor.process(ctx(carryCb.opening(KEY, 12700)));
    expect(deps.incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12700, categoryId: "ic1" }),
    );
    expect(deps.userRepository.claimCarryCycle).toHaveBeenCalledWith("u1", KEY);
  });

  it("files savings as a SAVINGS expense when there is no box", async () => {
    await processor.process(ctx(carryCb.savingsNoBox(KEY, 12700)));
    expect(deps.expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12700, bucket: "SAVINGS" }),
    );
    expect(deps.boxRepository.addEntry).not.toHaveBeenCalled();
  });

  it("links the box entry to the expense and leaves the expense alive", async () => {
    await processor.process(ctx(carryCb.box(KEY, 12700, "b1")));
    expect(deps.boxRepository.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        boxId: "b1",
        direction: "IN",
        source: "LINKED",
        sourceExpenseId: "e1",
      }),
    );
    // Deleting it here would drop the money out of analytics entirely: the
    // linked entry is excluded from boxContributed precisely because the
    // expense is meant to still be counted.
    expect(deps.expenseRepository.softDelete).not.toHaveBeenCalled();
  });

  it("skips the box picker when the user has no boxes", async () => {
    await processor.process(ctx(carryCb.savings(KEY, 12700)));
    expect(deps.expenseRepository.create).toHaveBeenCalledOnce();
    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
  });

  it("offers the box picker when the user has boxes", async () => {
    deps.boxRepository.listWithBalances.mockResolvedValue([
      { id: "b1", name: "Emergency", icon: "🏦" },
    ]);
    await processor.process(ctx(carryCb.savings(KEY, 12700)));
    expect(deps.expenseRepository.create).not.toHaveBeenCalled();
    const [, , rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(rows[0][0].id).toBe(carryCb.box(KEY, 12700, "b1"));
  });

  it("writes nothing when the claim is lost to the dashboard", async () => {
    deps.userRepository.claimCarryCycle.mockResolvedValue(false);
    await processor.process(ctx(carryCb.opening(KEY, 12700)));
    expect(deps.incomeRepository.create).not.toHaveBeenCalled();
  });

  it("refuses a button drawn for an older cycle", async () => {
    await processor.process(ctx(carryCb.opening("2020-01-01", 12700)));
    expect(deps.userRepository.claimCarryCycle).not.toHaveBeenCalled();
    expect(deps.incomeRepository.create).not.toHaveBeenCalled();
  });

  it("refuses once the cycle is already settled", async () => {
    await processor.process(
      ctx(carryCb.opening(KEY, 12700), { carryDecidedKey: KEY }),
    );
    expect(deps.incomeRepository.create).not.toHaveBeenCalled();
  });

  it("stages a CARRY_AMOUNT request for the typed path", async () => {
    await processor.process(ctx(carryCb.other(KEY)));
    expect(pendingActionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        kind: "CARRY_AMOUNT",
        payload: { cycleKey: KEY },
      }),
    );
    // Nothing is settled yet — the amount is still unknown.
    expect(deps.userRepository.claimCarryCycle).not.toHaveBeenCalled();
  });

  it("still saves the money when the chosen box has been deleted", async () => {
    deps.boxRepository.findByIdForUser.mockResolvedValue(null);
    const out = await processor.process(ctx(carryCb.box(KEY, 12700, "gone")));
    expect(deps.expenseRepository.create).toHaveBeenCalledOnce();
    expect(deps.boxRepository.addEntry).not.toHaveBeenCalled();
    expect(out.response).toContain("box is gone");
  });
});
