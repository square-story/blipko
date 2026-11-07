import { describe, expect, it } from "vitest";
import { clarityCb, parseClarityCallback } from "./clarityCallback";

describe("clarity callback", () => {
  it("round-trips a cycle key and score", () => {
    expect(clarityCb("2026-05-01", 4)).toBe("clr:2026-05-01:4");
    expect(parseClarityCallback(clarityCb("2026-05-01", 4))).toEqual({
      cycleKey: "2026-05-01",
      score: 4,
    });
  });

  it("rejects out-of-range scores, bad keys and plain text", () => {
    expect(parseClarityCallback("clr:2026-05-01:6")).toBeNull();
    expect(parseClarityCallback("clr:2026-05-01:0")).toBeNull();
    expect(parseClarityCallback("clr:bad:3")).toBeNull();
    expect(parseClarityCallback("chai 30")).toBeNull();
  });
});
