import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportProcessor } from "./ReportProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

describe("ReportProcessor", () => {
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let messageService: any;
  let incomeRepository: any;
  let processor: ReportProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Needs 23,400/25,000 (under) · Wants 16,200/15,000 (over) · Savings 10,000/10,000 (hit)
    const spend: Record<string, number> = {
      NEEDS: 23400,
      WANTS: 16200,
      SAVINGS: 10000,
    };
    expenseRepository = {
      sumByBucketForMonth: vi.fn((_u: string, bucket: string) =>
        Promise.resolve(spend[bucket] ?? 0),
      ),
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
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(0),
      sumEarnedForMonth: vi.fn().mockResolvedValue(0),
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
    expect(body).toContain("Income ₹0");
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

  // /report used to print the EARNED figure under the label "Income logged", so
  // a refund was invisible here while /status called it out. Same line now.
  it("names the money coming back when gross and earned differ", async () => {
    incomeRepository.sumForMonth.mockResolvedValue(69000);
    incomeRepository.sumEarnedForMonth.mockResolvedValue(62000);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "report",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Income ₹69,000");
    expect(body).toContain("budget on ₹62,000");
    expect(body).toContain("₹7,000 of that is money coming back");
  });

  it("stays short when every rupee was earned", async () => {
    incomeRepository.sumForMonth.mockResolvedValue(62000);
    incomeRepository.sumEarnedForMonth.mockResolvedValue(62000);

    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "report",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Income ₹62,000");
    expect(body).not.toContain("money coming back");
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
