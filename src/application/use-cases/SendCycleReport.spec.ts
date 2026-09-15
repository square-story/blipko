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
  // Already settled for the June cycle these tests run in, so the report is a
  // plain message. The carry-forward question has its own block below.
  carryDecidedKey: "2026-06-01",
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
    incomeRepository = {
      sumForMonth: vi.fn().mockResolvedValue(0),
      sumEarnedForMonth: vi.fn().mockResolvedValue(0),
      sumCarryForMonth: vi.fn().mockResolvedValue(0),
    };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m1"),
    };
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

  // The delivery window (07:00-10:59 local) — no `force`, so this is the gate.
  describe("local delivery window", () => {
    const dayOne = (hour: number) => new Date(Date.UTC(2026, 5, 1, hour));

    it("stays quiet before the window opens", async () => {
      const { sent } = await useCase.execute(dayOne(6));
      expect(sent).toBe(0);
      expect(messageService.sendMessage).not.toHaveBeenCalled();
    });

    it("sends at the opening hour", async () => {
      const { sent } = await useCase.execute(dayOne(7));
      expect(sent).toBe(1);
    });

    it("still sends late in the window, so a delayed tick is not lost", async () => {
      const { sent } = await useCase.execute(dayOne(10));
      expect(sent).toBe(1);
    });

    it("stays quiet after the window closes", async () => {
      const { sent } = await useCase.execute(dayOne(11));
      expect(sent).toBe(0);
    });
  });

  describe("carry-forward question", () => {
    const unsettled = { ...user, carryDecidedKey: null };
    const dayOne = new Date(Date.UTC(2026, 5, 1, 12));

    beforeEach(() => {
      userRepository.findOnboardedWithTelegram.mockResolvedValue([unsettled]);
    });

    it("rides the report as buttons when the cycle ended in the black", async () => {
      incomeRepository.sumForMonth.mockResolvedValue(50000);
      const { sent } = await useCase.execute(dayOne, true);
      expect(sent).toBe(1);
      // One message, not two: the question is appended to the report.
      expect(messageService.sendMessage).not.toHaveBeenCalled();
      const [, body, rows] =
        messageService.sendInteractiveMessage.mock.calls[0];
      expect(body).toContain("Where should it go?");
      // Buttons carry the NEW cycle's key, not the ended one.
      expect(rows[0][0].id).toBe("car:2026-06-01:s:50000");
      expect(rows[0][1].id).toBe("car:2026-06-01:o:50000");
      expect(rows[1][0].id).toBe("car:2026-06-01:x");
      expect(rows[1][1].id).toBe("car:2026-06-01:n");
    });

    it("stays a plain report when the cycle had nothing logged", async () => {
      // No income, no spend — but monthlyIncome is 50000, so the report's net
      // is the whole budget. Offering that as "leftover" would be nonsense.
      const { sent } = await useCase.execute(dayOne, true);
      expect(sent).toBe(1);
      expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
    });

    it("offers cash left over, not the expected-salary floor", async () => {
      // Logged 30000 against an expected 50000 and spent nothing. The budget
      // is floored at 50000, so "budget − spend" would offer 50000 — 20000 of
      // it money that never arrived, and the floor would mint it again next
      // cycle.
      incomeRepository.sumForMonth.mockResolvedValue(30000);
      await useCase.execute(dayOne, true);
      const [, , rows] = messageService.sendInteractiveMessage.mock.calls[0];
      expect(rows[0][0].id).toBe("car:2026-06-01:s:30000");
    });

    it("stays a plain report when spend ate all the logged income", async () => {
      incomeRepository.sumForMonth.mockResolvedValue(30000);
      expenseRepository.sumByBucketForMonth.mockResolvedValue(10000); // ×3 buckets
      await useCase.execute(dayOne, true);
      expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
    });

    it("stays a plain report when the cycle ended overspent", async () => {
      // Spend far beyond anything logged → no cash left to carry.
      incomeRepository.sumForMonth.mockResolvedValue(50000);
      expenseRepository.sumByBucketForMonth.mockResolvedValue(40000);
      const { sent } = await useCase.execute(dayOne, true);
      expect(sent).toBe(1);
      expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
      expect(messageService.sendMessage).toHaveBeenCalledOnce();
    });

    it("stays a plain report once the dashboard settled the cycle", async () => {
      incomeRepository.sumForMonth.mockResolvedValue(50000);
      userRepository.findOnboardedWithTelegram.mockResolvedValue([
        { ...unsettled, carryDecidedKey: "2026-06-01" },
      ]);
      await useCase.execute(dayOne, true);
      expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
      expect(messageService.sendMessage).toHaveBeenCalledOnce();
    });
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
