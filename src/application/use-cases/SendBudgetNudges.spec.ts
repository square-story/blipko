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

    expect(sent).toBe(2); // the alert, plus the check-in every dosage now gets
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

  it("sends only the check-in when every bucket is under the threshold", async () => {
    setSpend({ NEEDS: 5000, WANTS: 5000 });

    const { sent } = await useCase.execute(NOW, true);

    expect(sent).toBe(1);
    const kinds = nudgeRepository.recordSentIfNew.mock.calls.map(
      (c: any) => c[2],
    );
    expect(kinds).toEqual(["CHECKIN"]);
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Daily check-in",
    );
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

  // Send windows are per dosage, and the fixture user is on UTC, so the UTC hour
  // IS the local hour. These run WITHOUT force — they are the gate.
  describe("send windows per dosage", () => {
    const at = (hour: number, day = 15) =>
      new Date(Date.UTC(2026, 5, day, hour));

    // Stand in for the unique index: first record of a key wins, later ones lose.
    const useLedger = () => {
      const recorded = new Set<string>();
      nudgeRepository.recordSentIfNew = vi.fn(
        (u: string, b: string, k: string, key: string) => {
          const id = [u, b, k, key].join("|");
          if (recorded.has(id)) return Promise.resolve(false);
          recorded.add(id);
          return Promise.resolve(true);
        },
      );
      return recorded;
    };

    const asDosage = (notificationDosage: string) =>
      userRepository.findOnboardedWithTelegram.mockResolvedValue([
        { ...user, notificationDosage },
      ]);

    it("GENTLE speaks in the evening only", async () => {
      asDosage("GENTLE");

      expect((await useCase.execute(at(9))).sent).toBe(0);
      expect((await useCase.execute(at(13))).sent).toBe(0);
      expect((await useCase.execute(at(19))).sent).toBe(1);
      expect((await useCase.execute(at(23))).sent).toBe(0);
    });

    it("AGGRESSIVE adds a midday window", async () => {
      asDosage("AGGRESSIVE");

      expect((await useCase.execute(at(9))).sent).toBe(0);
      expect((await useCase.execute(at(13))).sent).toBe(1);
      expect((await useCase.execute(at(19))).sent).toBe(1);
    });

    it("RELENTLESS speaks in three windows", async () => {
      asDosage("RELENTLESS");

      expect((await useCase.execute(at(9))).sent).toBe(1);
      expect((await useCase.execute(at(14))).sent).toBe(1);
      expect((await useCase.execute(at(19))).sent).toBe(1);
      expect((await useCase.execute(at(23))).sent).toBe(0);
    });

    it("still sends late in a window, so a delayed tick is not lost", async () => {
      asDosage("AGGRESSIVE");

      expect((await useCase.execute(at(16))).sent).toBe(1); // 13:00 window, last hour
      expect((await useCase.execute(at(22))).sent).toBe(1); // 19:00 window, last hour
    });

    it("collapses several ticks inside one window into a single send", async () => {
      asDosage("RELENTLESS");
      useLedger();

      const first = await useCase.execute(at(19));
      const second = await useCase.execute(at(21));

      expect(first.sent).toBe(1);
      expect(second.sent).toBe(0);
      expect(messageService.sendMessage).toHaveBeenCalledTimes(1);
    });

    // The point of the whole change: dosage sets messages per day.
    it("gives RELENTLESS three check-ins a day where GENTLE gets one", async () => {
      const countCheckins = async (dosage: string) => {
        vi.clearAllMocks();
        asDosage(dosage);
        useLedger();
        messageService.sendMessage = vi.fn().mockResolvedValue("m1");
        for (const h of [9, 11, 14, 16, 19, 21]) await useCase.execute(at(h));
        return messageService.sendMessage.mock.calls.length;
      };

      expect(await countCheckins("RELENTLESS")).toBe(3);
      expect(await countCheckins("AGGRESSIVE")).toBe(2);
      expect(await countCheckins("GENTLE")).toBe(1);
    });
  });

  // A bucket sitting at 80-100% used to alert once per CYCLE, so it could stay
  // hot all month in silence. That is what the user reported.
  describe("a hot bucket keeps nagging", () => {
    const evening = (day: number) => new Date(Date.UTC(2026, 5, day, 19));

    const warnsAcrossTwoDays = async (dosage: string) => {
      const recorded = new Set<string>();
      nudgeRepository.recordSentIfNew = vi.fn(
        (u: string, b: string, k: string, key: string) => {
          const id = [u, b, k, key].join("|");
          if (recorded.has(id)) return Promise.resolve(false);
          recorded.add(id);
          return Promise.resolve(true);
        },
      );
      userRepository.findOnboardedWithTelegram.mockResolvedValue([
        { ...user, notificationDosage: dosage },
      ]);
      setSpend({ WANTS: 13500 }); // 90% of 15000

      await useCase.execute(evening(15));
      await useCase.execute(evening(16));

      return [...recorded].filter((k) => k.includes("WARN_80")).length;
    };

    it("repeats WARN_80 daily for RELENTLESS", async () => {
      expect(await warnsAcrossTwoDays("RELENTLESS")).toBe(2);
    });

    it("repeats WARN_80 daily for AGGRESSIVE", async () => {
      expect(await warnsAcrossTwoDays("AGGRESSIVE")).toBe(2);
    });

    it("keeps WARN_80 to once a cycle for GENTLE", async () => {
      expect(await warnsAcrossTwoDays("GENTLE")).toBe(1);
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
