import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostRecurringChargesUseCase } from "./PostRecurringCharges";

describe("PostRecurringCharges", () => {
  let recurringRuleRepository: any;
  let expenseRepository: any;
  let incomeRepository: any;
  let userRepository: any;
  let categoryRepository: any;
  let messageService: any;
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
      findActiveUnpostedForMonth: vi.fn().mockResolvedValue([expenseRule]),
      markPosted: vi.fn().mockResolvedValue(undefined),
    };
    expenseRepository = { create: vi.fn().mockResolvedValue({ id: "e1" }) };
    incomeRepository = { create: vi.fn().mockResolvedValue({ id: "i1" }) };
    userRepository = {
      findById: vi.fn().mockResolvedValue({ id: "u1", telegramId: "123" }),
    };
    categoryRepository = {
      findById: vi.fn().mockResolvedValue({ id: "c1", name: "Rent" }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    useCase = new PostRecurringChargesUseCase(
      recurringRuleRepository,
      expenseRepository,
      incomeRepository,
      userRepository,
      categoryRepository,
      messageService,
      async (fn: any) => fn({}),
    );
  });

  it("posts a due expense, marks it, and notifies", async () => {
    const { posted } = await useCase.execute(new Date(2026, 5, 15)); // day 15 >= dueDay 1

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

  it("skips a rule before its due day", async () => {
    recurringRuleRepository.findActiveUnpostedForMonth.mockResolvedValue([
      { ...expenseRule, dayOfMonth: 28 },
    ]);

    const { posted } = await useCase.execute(new Date(2026, 5, 15)); // day 15 < 28

    expect(posted).toBe(0);
    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(recurringRuleRepository.markPosted).not.toHaveBeenCalled();
  });

  it("posts a due income via the income repository", async () => {
    recurringRuleRepository.findActiveUnpostedForMonth.mockResolvedValue([
      {
        id: "rr2",
        userId: "u1",
        kind: "INCOME",
        amount: 50000,
        dayOfMonth: 25,
        note: "salary",
      },
    ]);

    const { posted } = await useCase.execute(new Date(2026, 5, 26)); // day 26 >= 25

    expect(posted).toBe(1);
    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 50000 }),
      expect.anything(),
    );
    expect(expenseRepository.create).not.toHaveBeenCalled();
  });
});
