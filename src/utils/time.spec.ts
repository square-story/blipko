import { describe, it, expect } from "vitest";
import { zonedParts, zonedYmd, zonedStartOfDayUtc } from "./time";

describe("time (tz helpers)", () => {
  it("reflects the wall-clock in the given tz", () => {
    const d = new Date("2026-01-01T00:00:00Z"); // IST is +5:30 → 05:30 Jan 1
    expect(zonedParts(d, "Asia/Kolkata")).toMatchObject({
      year: 2026,
      month: 1,
      day: 1,
      hour: 5,
    });
    expect(zonedParts(d, "UTC").hour).toBe(0);
  });

  it("crosses the local day boundary vs UTC", () => {
    // 20:00Z → New York (−5) is 15:00 Jan 1; Kolkata (+5:30) is 01:30 Jan 2.
    const d = new Date("2026-01-01T20:00:00Z");
    expect(zonedYmd(d, "America/New_York")).toBe("2026-01-01");
    expect(zonedYmd(d, "Asia/Kolkata")).toBe("2026-01-02");
    expect(zonedParts(d, "Asia/Kolkata").hour).toBe(1);
  });

  it("returns the UTC instant of local midnight", () => {
    // IST midnight Jan 2 = 2026-01-01T18:30:00Z.
    expect(zonedStartOfDayUtc(2026, 1, 2, "Asia/Kolkata").toISOString()).toBe(
      "2026-01-01T18:30:00.000Z",
    );
  });
});
