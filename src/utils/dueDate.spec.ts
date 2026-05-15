import { describe, it, expect } from "vitest";
import { addMonths, computeDueDatesInWindow } from "./dueDate";

describe("addMonths", () => {
  it("advances by 1 month", () => {
    const d = new Date(2026, 0, 15); // Jan 15
    expect(addMonths(d, 1)).toEqual(new Date(2026, 1, 15)); // Feb 15
  });

  it("rolls over year boundary", () => {
    expect(addMonths(new Date(2026, 11, 10), 1)).toEqual(new Date(2027, 0, 10));
  });

  it("advances by 3 months (QUARTERLY step)", () => {
    expect(addMonths(new Date(2026, 9, 5), 3)).toEqual(new Date(2027, 0, 5));
  });
});

describe("computeDueDatesInWindow", () => {
  const from = new Date(2026, 4, 15); // May 15
  const to = new Date(2026, 7, 15);   // Aug 15

  it("returns MONTHLY dues within window", () => {
    const dates = computeDueDatesInWindow(1, "MONTHLY", new Date(2026, 0, 1), null, from, to);
    expect(dates).toHaveLength(3);
    expect(dates[0]).toEqual(new Date(2026, 5, 1));  // Jun 1
    expect(dates[1]).toEqual(new Date(2026, 6, 1));  // Jul 1
    expect(dates[2]).toEqual(new Date(2026, 7, 1));  // Aug 1
  });

  it("includes due on fromDate (boundary inclusive)", () => {
    // dayOfMonth=15, from=May 15 — May 15 itself should be included
    const dates = computeDueDatesInWindow(15, "MONTHLY", new Date(2026, 0, 15), null, from, to);
    expect(dates[0]).toEqual(new Date(2026, 4, 15)); // May 15 included
  });

  it("returns QUARTERLY dues within window", () => {
    const dates = computeDueDatesInWindow(1, "QUARTERLY", new Date(2026, 1, 1), null, from, to);
    // May 1 is before from, next is Aug 1
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2026, 7, 1));
  });

  it("returns empty array when chargeStartDate > toDate", () => {
    const future = new Date(2027, 0, 1);
    const dates = computeDueDatesInWindow(1, "MONTHLY", future, null, from, to);
    expect(dates).toHaveLength(0);
  });

  it("returns empty array when fromDate > toDate", () => {
    const dates = computeDueDatesInWindow(1, "MONTHLY", new Date(2026, 0, 1), null, to, from);
    expect(dates).toHaveLength(0);
  });

  it("respects endDate — excludes dues after endDate", () => {
    const endDate = new Date(2026, 5, 30); // Jun 30
    const dates = computeDueDatesInWindow(1, "MONTHLY", new Date(2026, 0, 1), endDate, from, to);
    // Jun 1 is before endDate, Jul 1 is after — only Jun 1
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2026, 5, 1));
  });

  it("endDate boundary is inclusive", () => {
    const endDate = new Date(2026, 6, 1); // Jul 1 exactly
    const dates = computeDueDatesInWindow(1, "MONTHLY", new Date(2026, 0, 1), endDate, from, to);
    expect(dates).toHaveLength(2); // Jun 1 and Jul 1
    expect(dates[1]).toEqual(new Date(2026, 6, 1));
  });

  it("QUARTERLY crosses year boundary correctly", () => {
    const start = new Date(2025, 9, 1); // Oct 1 2025
    const windowFrom = new Date(2026, 4, 1);
    const windowTo = new Date(2026, 11, 31);
    const dates = computeDueDatesInWindow(1, "QUARTERLY", start, null, windowFrom, windowTo);
    // From Oct: Oct 1, Jan 1, Apr 1, Jul 1, Oct 1
    // In window May-Dec 2026: Jul 1 and Oct 1
    expect(dates).toHaveLength(2);
    expect(dates[0]).toEqual(new Date(2026, 6, 1));  // Jul 1
    expect(dates[1]).toEqual(new Date(2026, 9, 1));  // Oct 1
  });

  it("dayOfMonth=28 works in February without overflow", () => {
    const dates = computeDueDatesInWindow(28, "MONTHLY", new Date(2026, 0, 28), null,
      new Date(2026, 1, 1), new Date(2026, 2, 28));
    expect(dates[0]).toEqual(new Date(2026, 1, 28)); // Feb 28 — valid
  });
});
