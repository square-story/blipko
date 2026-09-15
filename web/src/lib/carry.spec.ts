import { describe, it, expect } from "vitest";
import { shouldPromptCarry } from "./carry";

const IST = "Asia/Kolkata";

// payday=1 → cycles are calendar months. Oct 1 00:00 IST is Sep 30 18:30 UTC.
const base = {
  carryDecidedKey: null,
  payday: 1,
  tz: IST,
  userCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
  hadActivity: true,
};

describe("shouldPromptCarry", () => {
  it("prompts on day 1 with the new cycle's key", () => {
    const now = new Date("2026-10-01T06:00:00.000Z"); // 11:30 IST, Oct 1
    expect(shouldPromptCarry({ ...base, now })).toBe("2026-10-01");
  });

  it("keeps prompting inside the window", () => {
    const now = new Date("2026-10-07T06:00:00.000Z");
    expect(shouldPromptCarry({ ...base, now })).toBe("2026-10-01");
  });

  it("gives up once the window closes", () => {
    const now = new Date("2026-10-08T06:00:00.000Z");
    expect(shouldPromptCarry({ ...base, now })).toBeNull();
  });

  it("stays quiet once the cycle is settled", () => {
    const now = new Date("2026-10-01T06:00:00.000Z");
    expect(
      shouldPromptCarry({ ...base, carryDecidedKey: "2026-10-01", now }),
    ).toBeNull();
  });

  it("asks again next cycle after settling the last one", () => {
    const now = new Date("2026-11-01T06:00:00.000Z");
    expect(
      shouldPromptCarry({ ...base, carryDecidedKey: "2026-10-01", now }),
    ).toBe("2026-11-01");
  });

  it("stays quiet for an account created inside this cycle", () => {
    const now = new Date("2026-10-03T06:00:00.000Z");
    const userCreatedAt = new Date("2026-10-02T06:00:00.000Z");
    expect(shouldPromptCarry({ ...base, userCreatedAt, now })).toBeNull();
  });

  it("stays quiet when the previous cycle had nothing logged", () => {
    const now = new Date("2026-10-01T06:00:00.000Z");
    expect(shouldPromptCarry({ ...base, hadActivity: false, now })).toBeNull();
  });

  it("reads the user's wall clock, not the server's", () => {
    // 20:00 UTC on Sep 30 is already 01:30 on Oct 1 in IST — day 1 there,
    // still the last day of September in UTC.
    const now = new Date("2026-09-30T20:00:00.000Z");
    expect(shouldPromptCarry({ ...base, now })).toBe("2026-10-01");
    expect(shouldPromptCarry({ ...base, tz: "UTC", now })).toBeNull();
  });
});
