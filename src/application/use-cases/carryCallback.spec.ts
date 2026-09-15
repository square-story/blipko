import { describe, it, expect } from "vitest";
import { carryCb, parseCarryCallback } from "./carryCallback";

const KEY = "2026-10-01";

describe("carryCallback", () => {
  it("round-trips every button", () => {
    expect(parseCarryCallback(carryCb.savings(KEY, 12700))).toEqual({
      cycleKey: KEY,
      choice: "s",
      amount: 12700,
    });
    expect(parseCarryCallback(carryCb.savingsNoBox(KEY, 12700))).toEqual({
      cycleKey: KEY,
      choice: "s0",
      amount: 12700,
    });
    expect(parseCarryCallback(carryCb.box(KEY, 12700, "box1"))).toEqual({
      cycleKey: KEY,
      choice: "b",
      amount: 12700,
      boxId: "box1",
    });
    expect(parseCarryCallback(carryCb.opening(KEY, 12700))).toEqual({
      cycleKey: KEY,
      choice: "o",
      amount: 12700,
    });
    expect(parseCarryCallback(carryCb.other(KEY))).toEqual({
      cycleKey: KEY,
      choice: "x",
    });
    expect(parseCarryCallback(carryCb.skip(KEY))).toEqual({
      cycleKey: KEY,
      choice: "n",
    });
  });

  it("rounds the amount so the grammar stays integer-only", () => {
    expect(parseCarryCallback(carryCb.savings(KEY, 12700.46))?.amount).toBe(
      12700,
    );
  });

  it("returns null for anything malformed", () => {
    for (const bad of [
      "",
      "act:x:y",
      "car:",
      `car:${KEY}`,
      `car:${KEY}:z:100`,
      `car:${KEY}:s`, // amount missing
      `car:${KEY}:s:`, // amount empty
      `car:${KEY}:s:0`, // zero is not money to carry
      `car:${KEY}:s:-5`,
      `car:${KEY}:s:12.5`, // amounts are integers in the grammar
      `car:${KEY}:s:100:extra`,
      `car:${KEY}:b:100`, // box id missing
      `car:${KEY}:x:100`, // x takes no amount
      `car::s:100`, // cycle key missing
    ]) {
      expect(parseCarryCallback(bad)).toBeNull();
    }
  });
});
