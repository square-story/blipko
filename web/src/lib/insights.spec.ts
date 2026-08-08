import { describe, expect, it } from "vitest";
import {
  commitmentLoadInsight,
  deltaInsight,
  pacingInsight,
  pctChange,
  savingsRateInsight,
  weekdayInsight,
} from "./insights";
import { categoryPacing } from "./budget";

const MONEY = { currency: "INR", locale: "en-IN" };

describe("pctChange", () => {
  it("returns null when there is no baseline", () => {
    expect(pctChange(500, 0)).toBeNull();
    expect(pctChange(500, -1)).toBeNull();
  });

  it("computes a signed percentage", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });
});

describe("deltaInsight", () => {
  const base = { label: "Groceries", ...MONEY };

  it("returns null without a baseline, rather than claiming a new category spiked", () => {
    expect(deltaInsight({ ...base, current: 4000, previous: 0 })).toBeNull();
  });

  it("suppresses immaterial moves below the floor", () => {
    // The ₹40 -> ₹200 case: +400%, but ₹160 against a floor of ₹500 is noise.
    const out = deltaInsight({
      ...base,
      current: 200,
      previous: 40,
      materialFloor: 500,
    });
    expect(out).toBeNull();
  });

  it("reports the same move when it clears the floor", () => {
    const out = deltaInsight({
      ...base,
      current: 200,
      previous: 40,
      materialFloor: 100,
    });
    expect(out?.text).toContain("up 400%");
    expect(out?.tone).toBe("negative");
  });

  it("calls a sub-1% move flat instead of 'up 0%'", () => {
    const out = deltaInsight({ ...base, current: 10050, previous: 10000 });
    expect(out?.text).toContain("flat");
    expect(out?.tone).toBe("neutral");
  });

  it("treats a spend increase as negative and a decrease as positive", () => {
    expect(deltaInsight({ ...base, current: 2000, previous: 1000 })?.tone).toBe(
      "negative",
    );
    expect(deltaInsight({ ...base, current: 500, previous: 1000 })?.tone).toBe(
      "positive",
    );
  });

  it("inverts the polarity when higher is better", () => {
    const out = deltaInsight({
      ...base,
      label: "Savings",
      current: 2000,
      previous: 1000,
      higherIsWorse: false,
    });
    expect(out?.tone).toBe("positive");
  });

  it("formats money in the caller's currency, never a hardcoded symbol", () => {
    const inr = deltaInsight({ ...base, current: 2000, previous: 1000 });
    const usd = deltaInsight({
      ...base,
      current: 2000,
      previous: 1000,
      currency: "USD",
      locale: "en-US",
    });
    expect(inr?.text).toContain("₹");
    expect(usd?.text).toContain("$");
    expect(usd?.text).not.toContain("₹");
  });
});

describe("pacingInsight", () => {
  const cycle = { day: 15, daysInPeriod: 30, remainingDays: 16 };

  it("stays silent when there is no budget to pace against", () => {
    const pacing = categoryPacing({ spent: 5000, limit: null, ...cycle });
    expect(
      pacingInsight({
        pacing,
        spent: 5000,
        budget: null,
        remainingDays: 16,
        ...MONEY,
      }),
    ).toBeNull();
  });

  it("stays silent in the first days, when the run-rate is meaningless", () => {
    const early = { day: 2, daysInPeriod: 30, remainingDays: 29 };
    const pacing = categoryPacing({ spent: 900, limit: 10000, ...early });
    expect(pacing.reliable).toBe(false);
    expect(
      pacingInsight({
        pacing,
        spent: 900,
        budget: 10000,
        remainingDays: 29,
        ...MONEY,
      }),
    ).toBeNull();
  });

  it("warns when projected to overspend", () => {
    const pacing = categoryPacing({ spent: 8000, limit: 10000, ...cycle });
    const out = pacingInsight({
      pacing,
      spent: 8000,
      budget: 10000,
      remainingDays: 16,
      ...MONEY,
    });
    expect(out?.tone).toBe("warning");
    expect(out?.text).toContain("over budget");
  });

  it("reports already-overspent even before the run-rate is reliable", () => {
    const early = { day: 1, daysInPeriod: 30, remainingDays: 30 };
    const pacing = categoryPacing({ spent: 12000, limit: 10000, ...early });
    const out = pacingInsight({
      pacing,
      spent: 12000,
      budget: 10000,
      remainingDays: 30,
      ...MONEY,
    });
    expect(out?.tone).toBe("negative");
    expect(out?.text).toContain("over budget");
  });

  it("confirms on-track pacing with a safe daily figure", () => {
    const pacing = categoryPacing({ spent: 3000, limit: 10000, ...cycle });
    const out = pacingInsight({
      pacing,
      spent: 3000,
      budget: 10000,
      remainingDays: 16,
      ...MONEY,
    });
    expect(out?.tone).toBe("positive");
    expect(out?.text).toContain("On track");
  });
});

describe("savingsRateInsight", () => {
  it("returns null when no cycle has a known rate", () => {
    expect(
      savingsRateInsight([
        { trueSavingsRatePct: null },
        { trueSavingsRatePct: null },
      ]),
    ).toBeNull();
  });

  it("ignores unknown cycles rather than averaging them as zero", () => {
    const out = savingsRateInsight([
      { trueSavingsRatePct: null },
      { trueSavingsRatePct: 20 },
      { trueSavingsRatePct: 20 },
    ]);
    // Average over the two known cycles is 20, not 13.3.
    expect(out?.text).toContain("20% average");
  });

  it("compares against the configured target when given one", () => {
    expect(savingsRateInsight([{ trueSavingsRatePct: 25 }], 20)?.tone).toBe(
      "positive",
    );
    expect(savingsRateInsight([{ trueSavingsRatePct: 5 }], 20)?.tone).toBe(
      "warning",
    );
  });

  it("does not invent a comparison from a single cycle", () => {
    const out = savingsRateInsight([{ trueSavingsRatePct: 18 }]);
    expect(out?.text).toBe("You saved 18% of income this cycle.");
  });
});

describe("commitmentLoadInsight", () => {
  it("returns null when nothing is committed", () => {
    expect(
      commitmentLoadInsight(
        { committed: 0, incomeBasis: 50000, committedPct: 0 },
        MONEY.currency,
        MONEY.locale,
      ),
    ).toBeNull();
  });

  it("omits the percentage when income is unknown", () => {
    const out = commitmentLoadInsight(
      { committed: 20000, incomeBasis: 0, committedPct: null },
      MONEY.currency,
      MONEY.locale,
    );
    expect(out?.text).not.toContain("%");
    expect(out?.tone).toBe("neutral");
  });

  it("escalates tone as the committed share climbs", () => {
    const at = (pct: number) =>
      commitmentLoadInsight(
        { committed: pct * 1000, incomeBasis: 100000, committedPct: pct },
        MONEY.currency,
        MONEY.locale,
      )?.tone;
    expect(at(30)).toBe("neutral");
    expect(at(55)).toBe("warning");
    expect(at(80)).toBe("negative");
  });
});

describe("weekdayInsight", () => {
  const flat = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => ({
    weekday: w,
    total: 1000,
  }));

  it("returns null with no spending", () => {
    expect(
      weekdayInsight(
        flat.map((r) => ({ ...r, total: 0 })),
        MONEY.currency,
        MONEY.locale,
      ),
    ).toBeNull();
  });

  it("does not manufacture a habit from an even week", () => {
    const out = weekdayInsight(flat, MONEY.currency, MONEY.locale);
    expect(out?.text).toContain("spread evenly");
  });

  it("names the peak day when it genuinely stands out", () => {
    const spiky = [...flat];
    spiky[4] = { weekday: "Fri", total: 9000 };
    const out = weekdayInsight(spiky, MONEY.currency, MONEY.locale);
    expect(out?.text).toContain("Fri");
    expect(out?.text).toContain("heaviest day");
  });
});
