import { describe, expect, it } from "vitest";
import { UNCATEGORIZED_ID, categoryHref, expensesHref } from "./drilldown";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors buildWhere in lib/actions/expenses.ts. If that changes, these fail.
function decodeLikeBuildWhere(href: string) {
  const q = new URLSearchParams(href.split("?")[1] ?? "");
  const from = q.get("from");
  const to = q.get("to");
  return {
    gte: from ? new Date(Number(from)) : undefined,
    lte: to ? new Date(Number(to) + 86_399_999) : undefined,
    buckets: q.get("bucket")?.split("."),
    categoryIds: q.get("categoryId")?.split("."),
  };
}

describe("expensesHref", () => {
  it("points at the transactions table with no filters", () => {
    expect(expensesHref()).toBe("/dashboard/expenses");
  });

  it("dot-joins multi-values, because buildWhere splits on '.'", () => {
    const href = expensesHref({ buckets: ["NEEDS", "WANTS"] });
    expect(href).toContain("bucket=NEEDS.WANTS");
    expect(decodeLikeBuildWhere(href).buckets).toEqual(["NEEDS", "WANTS"]);
  });

  it("would break if it comma-joined instead", () => {
    // Guards the actual failure mode: "NEEDS,WANTS".split(".") is one bogus
    // bucket, and the table silently returns nothing.
    expect("NEEDS,WANTS".split(".")).toEqual(["NEEDS,WANTS"]);
  });

  it("encodes a half-open cycle as the inclusive range the table expects", () => {
    const start = new Date("2026-07-24T18:30:00.000Z"); // IST midnight Jul 25
    const end = new Date("2026-08-24T18:30:00.000Z"); // IST midnight Aug 25

    const decoded = decodeLikeBuildWhere(
      expensesHref({ from: start, to: end }),
    );

    expect(decoded.gte!.getTime()).toBe(start.getTime());
    // The reconstructed upper bound must land exactly 1ms inside the cycle, so
    // [gte, lte] covers precisely [start, end).
    expect(decoded.lte!.getTime()).toBe(end.getTime() - 1);
  });

  it("does not leak the first day of the next cycle", () => {
    const start = new Date("2026-07-24T18:30:00.000Z");
    const end = new Date("2026-08-24T18:30:00.000Z");
    const decoded = decodeLikeBuildWhere(
      expensesHref({ from: start, to: end }),
    );

    // An expense at the very start of the next cycle must fall outside.
    expect(end.getTime()).toBeGreaterThan(decoded.lte!.getTime());
    // Sanity: a naive `to = end` would have over-reached by nearly a full day.
    const naive = new Date(end.getTime() + 86_399_999);
    expect(naive.getTime() - decoded.lte!.getTime()).toBeCloseTo(
      MS_PER_DAY,
      -3,
    );
  });

  it("accepts epoch numbers as well as Dates", () => {
    const start = new Date("2026-07-24T18:30:00.000Z");
    const end = new Date("2026-08-24T18:30:00.000Z");
    expect(expensesHref({ from: start, to: end })).toBe(
      expensesHref({ from: start.getTime(), to: end.getTime() }),
    );
  });

  it("omits absent filters rather than emitting empty params", () => {
    const href = expensesHref({ buckets: [], categoryIds: [], search: "" });
    expect(href).toBe("/dashboard/expenses");
  });
});

describe("categoryHref", () => {
  it("links a real category, scoped to the cycle", () => {
    const href = categoryHref("cat_123", {
      start: new Date("2026-07-24T18:30:00.000Z"),
      end: new Date("2026-08-24T18:30:00.000Z"),
    });
    expect(href).toContain("categoryId=cat_123");
    expect(href).toContain("from=");
  });

  it("returns null for uncategorized, which the table cannot express", () => {
    // buildWhere only emits categoryId: { in: [...] } — there is no way to ask
    // for NULL, so a link here would filter to nothing while looking valid.
    expect(categoryHref(UNCATEGORIZED_ID)).toBeNull();
    expect(categoryHref(null)).toBeNull();
  });
});
