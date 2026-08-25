import { describe, it, expect, vi, beforeEach } from "vitest";
import { SendBudgetNudgesUseCase } from "./SendBudgetNudges";

const user = {
  id: "u1",
  telegramId: "123",
  monthlyIncome: 50000,
  payday: 1,
  timezone: "UTC",
  notificationDosage: "GENTLE",
};

// force=true bypasses the local-hour gate so the tests aren't clock-dependent.
const NOW = new Date(Date.UTC(2026, 5, 15, 12));

describe("SendBudgetNudges", () => {
  let userRepository: any;
  let expenseRepository: any;
  let budgetConfigRepository: any;
  let nudgeRepository: any;
  let messageService: any;
  let useCase: SendBudgetNudgesUseCase;

  // Helper: set per-bucket spend.
  const setSpend = (spend: Record<string, number>) => {
    expenseRepository.sumByBucketForMonth = vi.fn(
      (_u: string, bucket: string) => Promise.resolve(spend[bucket] ?? 0),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = {
      findOnboardedWithTelegram: vi.fn().mockResolvedValue([user]),
    };
    expenseRepository = {
      sumByBucketForMonth: vi.fn().mockResolvedValue(0),
    };
    budgetConfigRepository = {
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    nudgeRepository = { recordSentIfNew: vi.fn().mockResolvedValue(true) };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    const incomeRepository = { sumForMonth: vi.fn().mockResolvedValue(0) };
    useCase = new SendBudgetNudgesUseCase(
      userRepository,
      expenseRepository,
      budgetConfigRepository,
      nudgeRepository,
      incomeRepository as any,
      messageService,
    );
  });

  it("sends an overspend alert when a bucket is over budget", async () => {
    setSpend({ WANTS: 16200 }); // budget 15000 → over by 1200

    const { sent } = await useCase.execute(NOW, true);

    expect(sent).toBe(1);
    expect(nudgeRepository.recordSentIfNew).toHaveBeenCalledWith(
      "u1",
      "WANTS",
      "OVER",
      expect.any(String),
    );
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "gone over Wants by ₹1,200",
    );
  });

  it("sends an 80% warning when a bucket crosses the threshold", async () => {
    setSpend({ WANTS: 12000 }); // 80% of 15000

    await useCase.execute(NOW, true);

    expect(nudgeRepository.recordSentIfNew).toHaveBeenCalledWith(
      "u1",
      "WANTS",
      "WARN_80",
      expect.any(String),
    );
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Wants at 80%");
    expect(body).toContain("days left");
  });

  it("does not re-send a nudge already sent this month", async () => {
    setSpend({ WANTS: 16200 });
    nudgeRepository.recordSentIfNew.mockResolvedValue(false);

    const { sent } = await useCase.execute(NOW, true);

    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it("stays quiet when buckets are under the threshold", async () => {
    setSpend({ NEEDS: 5000, WANTS: 5000 });

    await useCase.execute(NOW, true);

    expect(nudgeRepository.recordSentIfNew).not.toHaveBeenCalled();
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it("sends nothing when the user's dosage is OFF", async () => {
    userRepository.findOnboardedWithTelegram.mockResolvedValue([
      { ...user, notificationDosage: "OFF" },
    ]);
    setSpend({ WANTS: 16200 });

    const { sent } = await useCase.execute(NOW, true);

    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  // The delivery window (19:00-22:59 local). The fixture user is on UTC, so the
  // UTC hour is the local hour. These run WITHOUT force — they are the gate.
  describe("local delivery window", () => {
    const at = (hour: number) => new Date(Date.UTC(2026, 5, 15, hour));

    it("stays quiet before the window opens", async () => {
      setSpend({ WANTS: 16200 });

      const result = await useCase.execute(at(18));

      expect(result.sent).toBe(0);
      expect(result.skipped.outsideWindow).toBe(1);
      expect(messageService.sendMessage).not.toHaveBeenCalled();
    });

    it("sends at the opening hour", async () => {
      setSpend({ WANTS: 16200 });

      const { sent } = await useCase.execute(at(19));

      expect(sent).toBe(1);
    });

    it("still sends late in the window, so a delayed tick is not lost", async () => {
      setSpend({ WANTS: 16200 });

      const { sent } = await useCase.execute(at(22));

      expect(sent).toBe(1);
    });

    it("stays quiet after the window closes", async () => {
      setSpend({ WANTS: 16200 });

      const result = await useCase.execute(at(23));

      expect(result.sent).toBe(0);
      expect(result.skipped.outsideWindow).toBe(1);
    });

    it("sends once across several ticks inside the window", async () => {
      setSpend({ WANTS: 16200 });
      // Stand in for the unique index: the first record wins, later ones lose.
      const recorded = new Set<string>();
      nudgeRepository.recordSentIfNew = vi.fn(
        (u: string, b: string, k: string, key: string) => {
          const id = [u, b, k, key].join("|");
          if (recorded.has(id)) return Promise.resolve(false);
          recorded.add(id);
          return Promise.resolve(true);
        },
      );

      const first = await useCase.execute(at(19));
      const second = await useCase.execute(at(21));

      expect(first.sent).toBe(1);
      expect(second.sent).toBe(0);
      expect(messageService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  it("reports why users were skipped", async () => {
    userRepository.findOnboardedWithTelegram.mockResolvedValue([
      { ...user, id: "off", notificationDosage: "OFF" },
      { ...user, id: "noTg", telegramId: null },
      { ...user, id: "broke", monthlyIncome: 0 },
    ]);

    const result = await useCase.execute(NOW, true);

    expect(result.considered).toBe(3);
    expect(result.skipped).toEqual({
      dosageOff: 1,
      noTelegram: 1,
      noIncome: 1,
      outsideWindow: 0,
    });
  });

  it("adds a daily check-in summary for RELENTLESS on top of alerts", async () => {
    userRepository.findOnboardedWithTelegram.mockResolvedValue([
      { ...user, notificationDosage: "RELENTLESS" },
    ]);
    setSpend({ WANTS: 16200 }); // over → OVER alert + daily CHECKIN

    const { sent } = await useCase.execute(NOW, true);

    expect(sent).toBe(2);
    const kinds = nudgeRepository.recordSentIfNew.mock.calls.map(
      (c: any) => c[2],
    );
    expect(kinds).toContain("OVER");
    expect(kinds).toContain("CHECKIN");
  });
});
