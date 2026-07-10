import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncomeProcessor } from "./IncomeProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

describe("IncomeProcessor", () => {
  let incomeRepository: any;
  let categoryRepository: any;
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let messageService: any;
  let processor: IncomeProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    incomeRepository = {
      create: vi.fn().mockResolvedValue({ id: "inc1" }),
      // General (budget) income this cycle: 55,000 (50k salary + 5k freelance).
      sumForMonth: vi.fn().mockResolvedValue(55000),
      // Total received incl. earmarked — display line.
      sumTotalForMonth: vi.fn().mockResolvedValue(55000),
      receivedByCategoryForMonth: vi.fn().mockResolvedValue([]),
      updateConfirmationMessageId: vi.fn().mockResolvedValue(undefined),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
    };
    expenseRepository = {
      sumByCategoryForMonth: vi.fn().mockResolvedValue(0),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new IncomeProcessor(
      incomeRepository,
      categoryRepository,
      expenseRepository,
      budgetConfigRepository,
      messageService,
    );
  });

  it("handles the INCOME intent only", () => {
    expect(
      processor.canHandle({
        parsed: { intent: "INCOME", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        parsed: { intent: "EXPENSE", confidence: 0.9 },
      } as any),
    ).toBe(false);
  });

  it("records general income and replies with the refreshed effective budget", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "got freelance 5000",
      parsed: {
        intent: "INCOME",
        amount: 5000,
        note: "freelance",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 5000,
        source: "freelance",
        categoryId: undefined,
      }),
    );
    const body = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(body).toContain("Income ₹5,000");
    expect(body).toContain("Income this cycle: ₹55,000");
    expect(body).toContain("Budget on ₹55,000");
    expect(body).toContain("Needs ₹27,500"); // 55000 * 50%
    expect(body).toContain("Wants ₹16,500"); // 55000 * 30%
    expect(body).toContain("Savings ₹11,000"); // 55000 * 20%
    expect(incomeRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "inc1",
      "m2",
    );
  });

  it("earmarks income to a leaf category and replies with the fund balance", async () => {
    categoryRepository.findByNameForUser.mockResolvedValue({
      id: "cat1",
      name: "House Maintenance",
      isGroup: false,
      icon: "🏠",
      bucket: "NEEDS",
    });
    incomeRepository.receivedByCategoryForMonth.mockResolvedValue([
      { categoryId: "cat1", total: 5000 },
    ]);
    expenseRepository.sumByCategoryForMonth.mockResolvedValue(0); // nothing spent yet

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "brother gave 5000 for house maintenance",
      parsed: {
        intent: "INCOME",
        amount: 5000,
        category: "House Maintenance",
        note: "from brother",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, categoryId: "cat1" }),
    );
    const body = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(body).toContain("House Maintenance fund");
    expect(body).toContain("Received ₹5,000");
    expect(body).toContain("left in the pot");
    // Earmarked income must NOT recompute the 50/30/20 budget.
    expect(body).not.toContain("Budget on");
  });

  it("treats a group-category match as general income (no earmark)", async () => {
    categoryRepository.findByNameForUser.mockResolvedValue({
      id: "grp1",
      name: "Essentials",
      isGroup: true,
      bucket: "NEEDS",
    });

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "got 5000 essentials",
      parsed: {
        intent: "INCOME",
        amount: 5000,
        category: "Essentials",
        confidence: 0.9,
      },
    } as any);

    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: undefined }),
    );
    const body = messageService.sendInteractiveMessage.mock.calls[0][1];
    expect(body).toContain("Budget on"); // general branch
  });

  it("asks again when the amount is missing", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "got paid",
      parsed: { intent: "INCOME", confidence: 0.4 },
    } as any);

    expect(incomeRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "couldn't catch the income amount",
    );
  });
});
