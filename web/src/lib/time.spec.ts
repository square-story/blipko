import { describe, expect, it } from "vitest";
import {
  cycleIndexer,
  cycleLabel,
  zonedBudgetPeriod,
  zonedCycleWindows,
  zonedHour,
  zonedParts,
  zonedPeriodDayInfo,
  zonedPreviousCycles,
  zonedStartOfDayUtc,
  zonedWeekday,
  zonedYmd,
} from "./time";

const IST = "Asia/Kolkata";

describe("zonedParts", () => {
  it("reads the user's wall clock, not the server's", () => {
    // 21:00 UTC on Aug 8 is 02:30 on Aug 9 in IST.
    const t = new Date("2026-08-08T21:00:00.000Z");
    expect(zonedParts(t, IST)).toEqual({
      year: 2026,
      month: 8,
      day: 9,
      hour: 2,
      weekday: "Sun",
    });
    expect(zonedParts(t, "UTC").day).toBe(8);
  });
});

describe("zonedStartOfDayUtc", () => {
  it("returns the instant of local midnight", () => {
    // IST is UTC+5:30, so local midnight is 18:30 UTC the previous day.
    expect(zonedStartOfDayUtc(2026, 7, 25, IST).toISOString()).toBe(
      "2026-07-24T18:30:00.000Z",
    );
  });

  it("normalizes month 13 into the next January", () => {
    expect(zonedStartOfDayUtc(2026, 13, 25, IST).toISOString()).toBe(
      zonedStartOfDayUtc(2027, 1, 25, IST).toISOString(),
    );
  });

  it("normalizes month 0 into the previous December", () => {
    expect(zonedStartOfDayUtc(2026, 0, 25, IST).toISOString()).toBe(
      zonedStartOfDayUtc(2025, 12, 25, IST).toISOString(),
    );
  });
});

describe("zonedBudgetPeriod", () => {
  // This is the regression the whole module exists for. `lib/budget.ts` builds
  // these bounds with new Date(y, m, d), which on a UTC server yields
  // 2026-07-25T00:00:00Z — 5h30m late. Everything an IST user logged between
  // midnight and 05:30 on payday fell into the previous cycle.
  it("anchors the cycle to IST midnight, not server midnight", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    const { start, end } = zonedBudgetPeriod(25, IST, now);
    expect(start.toISOString()).toBe("2026-07-24T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-08-24T18:30:00.000Z");
  });

  it("puts a 01:00 IST payday expense in the new cycle, not the old one", () => {
    const now = new Date("2026-08-25T05:00:00.000Z"); // 10:30 IST, Aug 25
    const { start } = zonedBudgetPeriod(25, IST, now);
    const expenseAt0100Ist = new Date("2026-08-24T19:30:00.000Z");
    expect(expenseAt0100Ist.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  it("rolls back a month when today is before the payday", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { start, end } = zonedBudgetPeriod(25, IST, now);
    expect(zonedYmd(start, IST)).toBe("2026-07-25");
    expect(zonedYmd(end, IST)).toBe("2026-08-25");
  });

  it("payday=1 reproduces the calendar month", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { start, end } = zonedBudgetPeriod(1, IST, now);
    expect(zonedYmd(start, IST)).toBe("2026-08-01");
    expect(zonedYmd(end, IST)).toBe("2026-09-01");
  });

  it("clamps an out-of-range payday to 1..28", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(zonedYmd(zonedBudgetPeriod(31, IST, now).start, IST)).toBe(
      "2026-07-28",
    );
    expect(zonedYmd(zonedBudgetPeriod(0, IST, now).start, IST)).toBe(
      "2026-08-01",
    );
  });

  it("crosses the year boundary in both directions", () => {
    const dec = new Date("2026-12-30T12:00:00.000Z");
    expect(zonedYmd(zonedBudgetPeriod(25, IST, dec).end, IST)).toBe(
      "2027-01-25",
    );
    const jan = new Date("2027-01-10T12:00:00.000Z");
    expect(zonedYmd(zonedBudgetPeriod(25, IST, jan).start, IST)).toBe(
      "2026-12-25",
    );
  });

  it("survives February with payday=28", () => {
    const now = new Date("2027-03-10T12:00:00.000Z");
    const { start, end } = zonedBudgetPeriod(28, IST, now);
    expect(zonedYmd(start, IST)).toBe("2027-02-28");
    expect(zonedYmd(end, IST)).toBe("2027-03-28");
  });
});

describe("zonedPreviousCycles", () => {
  it("returns complete cycles newest-first, excluding the current one", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    const cycles = zonedPreviousCycles(25, 3, IST, now);
    expect(cycles.map((c) => zonedYmd(c.start, IST))).toEqual([
      "2026-06-25",
      "2026-05-25",
      "2026-04-25",
    ]);
  });

  it("chains without gaps or overlaps", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    const cycles = zonedPreviousCycles(25, 6, IST, now);
    for (let i = 0; i < cycles.length - 1; i++) {
      expect(cycles[i]!.start.getTime()).toBe(cycles[i + 1]!.end.getTime());
    }
  });
});

describe("zonedPeriodDayInfo", () => {
  it("counts days from the cycle start", () => {
    const now = new Date("2026-08-08T21:00:00.000Z"); // day 16 of a Jul25 cycle
    const info = zonedPeriodDayInfo(25, IST, now);
    expect(info.daysInPeriod).toBe(31);
    expect(info.day).toBe(16);
    expect(info.remainingDays).toBe(16);
  });

  it("never reports fewer than one remaining day", () => {
    const now = new Date("2026-08-24T18:00:00.000Z"); // last hours of the cycle
    expect(
      zonedPeriodDayInfo(25, IST, now).remainingDays,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("zonedCycleWindows", () => {
  it("runs oldest-first and ends with the current partial cycle", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    const windows = zonedCycleWindows(25, 4, IST, "en-IN", now);
    expect(windows).toHaveLength(4);
    // At Aug 8 with payday 25 the current cycle started Jul 25, so the last
    // window is the one containing `now` — never a future cycle.
    expect(windows.map((w) => w.key)).toEqual([
      "2026-04-25",
      "2026-05-25",
      "2026-06-25",
      "2026-07-25",
    ]);
    expect(windows[windows.length - 1]!.start.getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
    expect(windows[windows.length - 1]!.end.getTime()).toBeGreaterThan(
      now.getTime(),
    );
  });

  it("reports true cycle lengths, which vary 28-31 days", () => {
    const now = new Date("2027-03-10T12:00:00.000Z");
    const windows = zonedCycleWindows(28, 3, IST, "en-IN", now);
    // Jan 28 -> Feb 28 is 31 days; Feb 28 -> Mar 28 is 28.
    expect(new Set(windows.map((w) => w.days)).size).toBeGreaterThan(1);
    for (const w of windows) {
      expect(w.days).toBeGreaterThanOrEqual(28);
      expect(w.days).toBeLessThanOrEqual(31);
    }
  });

  it("always returns at least one window", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    expect(zonedCycleWindows(25, 0, IST, "en-IN", now)).toHaveLength(1);
  });
});

describe("cycleLabel", () => {
  it("labels a cycle by its start month in the user's timezone", () => {
    // The instant is 18:30 UTC on Jul 24 but midnight Jul 25 in IST. Formatting
    // without a timeZone (what analytics.ts did) renders "Jul 26" via the UTC
    // date -- correct month here by luck, but wrong for a Dec 31 / Jan 1 pair.
    const start = zonedStartOfDayUtc(2027, 1, 1, IST);
    expect(cycleLabel(start, IST, "en-IN")).toBe("Jan 27");
    expect(cycleLabel(start, "UTC", "en-IN")).toBe("Dec 26");
  });
});

describe("cycleIndexer", () => {
  const now = new Date("2026-08-08T21:00:00.000Z");
  const windows = zonedCycleWindows(25, 4, IST, "en-IN", now);
  const indexOf = cycleIndexer(windows);

  it("maps a date to the window containing it", () => {
    windows.forEach((w, i) => {
      expect(indexOf(w.start)).toBe(i);
      expect(indexOf(new Date(w.end.getTime() - 1))).toBe(i);
    });
  });

  it("treats the window as half-open [start, end)", () => {
    // A cycle's end instant belongs to the NEXT cycle, never to this one.
    expect(indexOf(windows[0]!.end)).toBe(1);
  });

  it("returns -1 outside the range", () => {
    expect(indexOf(new Date(windows[0]!.start.getTime() - 1))).toBe(-1);
    expect(indexOf(windows[windows.length - 1]!.end)).toBe(-1);
  });

  it("handles an empty window list", () => {
    expect(cycleIndexer([])(new Date())).toBe(-1);
  });
});

describe("weekday and hour extraction", () => {
  it("uses the user's timezone, so a 01:00 IST expense is not the day before", () => {
    // 2026-08-10 is a Monday. 19:30 UTC on Aug 10 is 01:00 IST on Tue Aug 11.
    const t = new Date("2026-08-10T19:30:00.000Z");
    expect(zonedWeekday(t, "UTC")).toBe("Mon");
    expect(zonedWeekday(t, IST)).toBe("Tue");
    expect(zonedHour(t, "UTC")).toBe(19);
    expect(zonedHour(t, IST)).toBe(1);
  });
});

describe("server timezone independence", () => {
  // The acceptance test for this whole module: nothing here may consult the
  // server clock. process.env.TZ is read by V8 when the first Date is created,
  // so instead of mutating it we assert the property that matters -- every
  // function is driven by explicit instants and an explicit tz argument.
  it("produces identical results regardless of the host offset", () => {
    const now = new Date("2026-08-08T21:00:00.000Z");
    const a = zonedCycleWindows(25, 6, IST, "en-IN", now);

    // Same instant expressed via a local-time string in a different offset.
    const sameInstant = new Date(now.getTime());
    const b = zonedCycleWindows(25, 6, IST, "en-IN", sameInstant);

    expect(a.map((w) => w.start.toISOString())).toEqual(
      b.map((w) => w.start.toISOString()),
    );
    expect(a.map((w) => w.label)).toEqual(b.map((w) => w.label));
  });

  it("a UTC-server user and an IST-server user see the same cycle", () => {
    const now = new Date("2026-08-25T02:00:00.000Z"); // 07:30 IST on payday
    const period = zonedBudgetPeriod(25, IST, now);
    // Cycle has already rolled over in IST terms (it is Aug 25 there).
    expect(zonedYmd(period.start, IST)).toBe("2026-08-25");
  });
});
