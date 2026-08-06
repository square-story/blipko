import { describe, it, expect } from "vitest";
import { renderHistoryBlock } from "./historyBlock";

describe("renderHistoryBlock", () => {
  it("returns an empty string for no history", () => {
    expect(renderHistoryBlock(undefined)).toBe("");
    expect(renderHistoryBlock([])).toBe("");
  });

  it("labels turns and keeps oldest-to-newest order", () => {
    const block = renderHistoryBlock([
      { role: "user", content: "chai 30" },
      { role: "model", content: "Wants · Food ₹30" },
    ]);
    expect(block).toContain("user: chai 30");
    expect(block).toContain("bot: Wants · Food ₹30");
    expect(block.indexOf("user: chai 30")).toBeLessThan(
      block.indexOf("bot: Wants"),
    );
  });

  it("truncates a long turn", () => {
    const block = renderHistoryBlock([
      { role: "model", content: "x".repeat(1000) },
    ]);
    expect(block).toContain("…");
    expect(block.length).toBeLessThan(500);
  });

  it("drops the oldest turns when over the total cap", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: "model" as const,
      content: `turn-${i} ${"y".repeat(190)}`,
    }));
    const block = renderHistoryBlock(history);
    expect(block).toContain("turn-11");
    expect(block).not.toContain("turn-0 ");
  });

  it("collapses whitespace so multi-line replies stay one line each", () => {
    const block = renderHistoryBlock([
      { role: "model", content: "line one\n\nline two" },
    ]);
    expect(block).toContain("bot: line one line two");
  });
});
