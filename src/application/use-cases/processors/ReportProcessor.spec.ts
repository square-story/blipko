import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportProcessor } from "./ReportProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

describe("ReportProcessor", () => {
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let messageService: any;
  let processor: ReportProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Needs 23,400/25,000 (under) · Wants 16,200/15,000 (over) · Savings 10,000/10,000 (hit)
    // Uncategorized rows → no offset. Same rows returned for current + prior.
    expenseRepository = {
      spendByCategoryForMonth: vi.fn().mockResolvedValue([
        { categoryId: null, bucket: "NEEDS", total: 23400 },
        { categoryId: null, bucket: "WANTS", total: 16200 },
        { categoryId: null, bucket: "SAVINGS", total: 10000 },
      ]),
      topCategoriesForMonth: vi.fn().mockResolvedValue([
        { name: "Food delivery", total: 3800 },
        { name: "Shopping", total: 2900 },
      ]),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    const incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(0),
      sumTotalForMonth: vi.fn().mockResolvedValue(0),
      receivedByCategoryForMonth: vi.fn().mockResolvedValue([]),
    };
    processor = new ReportProcessor(
      expenseRepository,
      budgetConfigRepository,
      incomeRepository as any,
      messageService,
    );
  });

  it("matches 'report' and '/report' only", () => {
    const base = { user, platformUserId: "123" };
    expect(processor.canHandle({ ...base, textMessage: "report" } as any)).toBe(
      true,
    );
    expect(
      processor.canHandle({ ...base, textMessage: "/report" } as any),
    ).toBe(true);
    expect(processor.canHandle({ ...base, textMessage: "status" } as any)).toBe(
      false,
    );
  });

  it("renders income, per-bucket deltas, savings goal, and biggest leaks", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "report",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("summary");
    expect(body).toContain("Income logged ₹0");
    expect(body).toContain("budget on ₹50,000");
    expect(body).toContain("₹23,400 / ₹25,000");
    expect(body).toContain("under by ₹1,600");
    expect(body).toContain("₹16,200 / ₹15,000");
    expect(body).toContain("over by ₹1,200");
    expect(body).toContain("goal hit");
    expect(body).toContain("Biggest leaks in Wants:");
    expect(body).toContain("Food delivery  ₹3,800");
    expect(body).toContain("Shopping  ₹2,900");
  });

  it("omits the leaks section when there is no Wants spend", async () => {
    expenseRepository.topCategoriesForMonth.mockResolvedValue([]);
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "report",
    } as any);
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).not.toContain("Biggest leaks");
  });
});
