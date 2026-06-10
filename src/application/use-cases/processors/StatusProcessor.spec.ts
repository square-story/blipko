import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusProcessor } from "./StatusProcessor";

const user = { id: "u1", telegramId: "123", monthlyIncome: 50000 };

describe("StatusProcessor", () => {
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let messageService: any;
  let processor: StatusProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spend per bucket: Needs 21,400 / Wants 9,200 / Savings 10,000.
    const spend: Record<string, number> = {
      NEEDS: 21400,
      WANTS: 9200,
      SAVINGS: 10000,
    };
    expenseRepository = {
      sumByBucketForMonth: vi.fn((_u: string, bucket: string) =>
        Promise.resolve(spend[bucket] ?? 0),
      ),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    processor = new StatusProcessor(
      expenseRepository,
      budgetConfigRepository,
      messageService,
    );
  });

  it("matches the plain 'status' command and the STATUS intent", () => {
    expect(
      processor.canHandle({
        user,
        platformUserId: "123",
        textMessage: "status",
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        user,
        platformUserId: "123",
        textMessage: "/status",
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        user,
        platformUserId: "123",
        textMessage: "how much wants left",
        parsed: { intent: "STATUS", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        user,
        platformUserId: "123",
        textMessage: "lunch 30",
      } as any),
    ).toBe(false);
  });

  it("renders per-bucket bars, percentages, and safe daily spend", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "status",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("This month — Day");
    expect(body).toContain("₹21,400 / ₹25,000");
    expect(body).toContain("(86%)"); // 21400/25000
    expect(body).toContain("(61%)"); // 9200/15000
    expect(body).toContain("✅"); // savings goal hit (10000/10000)
    expect(body).toContain("Safe daily spend left:");
    expect(body).toContain("Needs");
    expect(body).toContain("Wants");
  });

  it("flags an over-budget bucket with 🔴", async () => {
    expenseRepository.sumByBucketForMonth = vi.fn((_u: string, bucket: string) =>
      Promise.resolve(bucket === "WANTS" ? 18000 : 0),
    );
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "status",
    } as any);
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("🔴"); // wants 18000/15000 = 120%
  });
});
