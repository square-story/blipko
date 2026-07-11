import { describe, it, expect, vi, beforeEach } from "vitest";
import { SendCycleReportUseCase } from "./SendCycleReport";

// payday=1 → cycle rolls over on the 1st. Jun 1 is day 1; Jun 10 is not.
// tz UTC + UTC-instant "now" keep the day math deterministic in tests.
const user = {
  id: "u1",
  telegramId: "123",
  monthlyIncome: 50000,
  payday: 1,
  timezone: "UTC",
};

describe("SendCycleReport", () => {
  let userRepository: any;
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let nudgeRepository: any;
  let incomeRepository: any;
  let messageService: any;
  let useCase: SendCycleReportUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = {
      findOnboardedWithTelegram: vi.fn().mockResolvedValue([user]),
    };
    expenseRepository = {
      sumByBucketForMonth: vi.fn().mockResolvedValue(0),
      categoryTotals: vi.fn().mockResolvedValue([]),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    nudgeRepository = { recordSentIfNew: vi.fn().mockResolvedValue(true) };
    incomeRepository = { sumForMonth: vi.fn().mockResolvedValue(0) };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    useCase = new SendCycleReportUseCase(
      userRepository,
      expenseRepository,
      budgetConfigRepository,
      nudgeRepository,
      incomeRepository,
      messageService,
    );
  });

  it("sends the report on day 1 of a new cycle", async () => {
    const { sent } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 1, 12)),
      true,
    );
    expect(sent).toBe(1);
    expect(nudgeRepository.recordSentIfNew).toHaveBeenCalledWith(
      "u1",
      "NEEDS",
      "CYCLE_REPORT",
      "2026-05-01", // ended cycle = May
    );
    expect(messageService.sendMessage).toHaveBeenCalledOnce();
  });

  it("does nothing mid-cycle", async () => {
    const { sent } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 10, 12)),
      true,
    );
    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it("is idempotent — skips when already recorded for this cycle", async () => {
    nudgeRepository.recordSentIfNew.mockResolvedValue(false);
    const { sent } = await useCase.execute(
      new Date(Date.UTC(2026, 5, 1, 12)),
      true,
    );
    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });
});
