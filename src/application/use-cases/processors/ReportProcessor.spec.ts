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
    processor = new ReportProcessor(
      expenseRepository,
      budgetConfigRepository,
      messageService,
    );
  });

  it("matches 'report' and '/report' only", () => {
    const base = { user, platformUserId: "123" };
    expect(processor.canHandle({ ...base, textMessage: "report" } as any)).toBe(true);
    expect(processor.canHandle({ ...base, textMessage: "/report" } as any)).toBe(true);
    expect(processor.canHandle({ ...base, textMessage: "status" } as any)).toBe(false);
  });

  it("renders income, per-bucket deltas, savings goal, and biggest leaks", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "report",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("summary");
    expect(body).toContain("Income ₹50,000");
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
