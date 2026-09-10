import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostRecurringChargesUseCase } from "./PostRecurringCharges";

describe("PostRecurringCharges", () => {
  let recurringRuleRepository: any;
  let expenseRepository: any;
  let incomeRepository: any;
  let userRepository: any;
  let categoryRepository: any;
  let messageService: any;
  let boxRepository: any;
  let useCase: PostRecurringChargesUseCase;

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

  beforeEach(() => {
    vi.clearAllMocks();
    recurringRuleRepository = {
      findAllActive: vi.fn().mockResolvedValue([expenseRule]),
      markPosted: vi.fn().mockResolvedValue(undefined),
    };
    expenseRepository = { create: vi.fn().mockResolvedValue({ id: "e1" }) };
    incomeRepository = { create: vi.fn().mockResolvedValue({ id: "i1" }) };
    userRepository = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: "u1", telegramId: "123", timezone: "UTC" }),
    };
    categoryRepository = {
      findById: vi.fn().mockResolvedValue({ id: "c1", name: "Rent" }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    boxRepository = {
      findByIdForUser: vi.fn().mockResolvedValue({ id: "b1", name: "NY Trip" }),
      addEntry: vi.fn().mockResolvedValue({ id: "be1" }),
    };
    useCase = new PostRecurringChargesUseCase(
      recurringRuleRepository,
      expenseRepository,
      incomeRepository,
      userRepository,
      categoryRepository,
      messageService,
      async (fn: any) => fn({}),
      boxRepository,
    );
  });

  it("posts a due expense, marks it, and notifies", async () => {
    // force=true bypasses the local-hour gate; tz UTC keeps the day math fixed.
    const { posted } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 15, 12)),
      true,
    ); // day 15 >= dueDay 1

    expect(posted).toBe(1);
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 8000, bucket: "NEEDS" }),
      expect.anything(),
    );
    expect(recurringRuleRepository.markPosted).toHaveBeenCalledWith(
      "rr1",
      "2026-06",
      expect.anything(),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Auto-logged",
    );
  });

  // The posting window (06:00-09:59 local) — no `force`, so this is the gate.
  describe("local posting window", () => {
    const at = (hour: number) => new Date(Date.UTC(2026, 5, 15, hour));

    it("stays quiet before the window opens", async () => {
      const { posted } = await useCase.execute(at(5));
      expect(posted).toBe(0);
      expect(expenseRepository.create).not.toHaveBeenCalled();
    });

    it("posts at the opening hour", async () => {
      const { posted } = await useCase.execute(at(6));
      expect(posted).toBe(1);
    });

    it("still posts late in the window, so a delayed tick is not lost", async () => {
      const { posted } = await useCase.execute(at(9));
      expect(posted).toBe(1);
    });

    it("stays quiet after the window closes", async () => {
      const { posted } = await useCase.execute(at(10));
      expect(posted).toBe(0);
    });

    it("posts once across several ticks inside the window", async () => {
      // Stand in for lastPostedKey: markPosted flips the rule for later ticks.
      recurringRuleRepository.markPosted = vi.fn(
        async (id: string, key: string) => {
          recurringRuleRepository.findAllActive.mockResolvedValue([
            { ...expenseRule, id, lastPostedKey: key },
          ]);
        },
      );

      const first = await useCase.execute(at(6));
      const second = await useCase.execute(at(8));

      expect(first.posted).toBe(1);
      expect(second.posted).toBe(0);
      expect(expenseRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  it("posts a due box contribution as an IN entry, notifies without undo hint", async () => {
    recurringRuleRepository.findAllActive.mockResolvedValue([
      {
        id: "rr2",
        userId: "u1",
        kind: "BOX",
        amount: 5000,
        dayOfMonth: 1,
        boxId: "b1",
        note: "trip",
      },
    ]);

    const { posted } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 15, 12)),
      true,
    );

    expect(posted).toBe(1);
    expect(boxRepository.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        boxId: "b1",
        userId: "u1",
        amount: 5000,
        direction: "IN",
        source: "MANUAL",
      }),
      expect.anything(),
    );
    expect(recurringRuleRepository.markPosted).toHaveBeenCalledWith(
      "rr2",
      "2026-06",
      expect.anything(),
    );
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("📦 NY Trip");
    expect(body).not.toContain("undo");
  });

  it("skips a rule before its due day", async () => {
    recurringRuleRepository.findAllActive.mockResolvedValue([
      { ...expenseRule, dayOfMonth: 28 },
    ]);

    const { posted } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 15, 12)),
      true,
    ); // day 15 < 28

    expect(posted).toBe(0);
    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(recurringRuleRepository.markPosted).not.toHaveBeenCalled();
  });

  it("posts a due income via the income repository", async () => {
    recurringRuleRepository.findAllActive.mockResolvedValue([
      {
        id: "rr2",
        userId: "u1",
        kind: "INCOME",
        amount: 50000,
        dayOfMonth: 25,
        note: "salary",
      },
    ]);

    const { posted } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 26, 12)),
      true,
    ); // day 26 >= 25

    expect(posted).toBe(1);
    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 50000 }),
      expect.anything(),
    );
    expect(expenseRepository.create).not.toHaveBeenCalled();
  });

  // The rule's category has to reach the row it posts, or every auto-logged
  // income is uncategorised — which counts as earnings, so a recurring
  // reimbursement would widen the budget every month.
  it("carries the rule's income category onto the posted row", async () => {
    recurringRuleRepository.findAllActive.mockResolvedValue([
      {
        id: "rr3",
        userId: "u1",
        kind: "INCOME",
        amount: 2500,
        dayOfMonth: 25,
        incomeCategoryId: "ic-reimbursement",
        note: "travel claim",
      },
    ]);

    await useCase.execute(new Date(Date.UTC(2026, 5, 26, 12)), true);

    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "ic-reimbursement" }),
      expect.anything(),
    );
  });
});
