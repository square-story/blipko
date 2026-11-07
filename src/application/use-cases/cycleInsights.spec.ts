import { describe, expect, it } from "vitest";
import {
  followUpLine,
  parseActionTarget,
  movers,
  nextCycleAction,
  unusualCategories,
  type BucketRow,
} from "./cycleInsights";

const fd = (total: number) => ({ name: "Food Delivery", total });

describe("unusualCategories", () => {
  it("flags Food Delivery at 3100 vs usual 1200", () => {
    expect(unusualCategories([fd(3100)], [[fd(1000)], [fd(1400)]])).toEqual([
      { name: "Food Delivery", total: 3100, usual: 1200 },
    ]);
  });

  it("ignores small categories below the ₹500 excess floor", () => {
    expect(unusualCategories([fd(120)], [[fd(40)], [fd(40)]])).toEqual([]);
  });

  it("ignores categories seen in fewer than 2 baseline cycles", () => {
    expect(unusualCategories([fd(3000)], [[fd(1000)], []])).toEqual([]);
  });

  it("returns [] with no baseline", () => {
    expect(unusualCategories([fd(3000)], [])).toEqual([]);
  });

  it("returns at most two, biggest excess first", () => {
    const base = [
      [
        { name: "A", total: 1000 },
        { name: "B", total: 1000 },
        { name: "C", total: 1000 },
      ],
      [
        { name: "A", total: 1000 },
        { name: "B", total: 1000 },
        { name: "C", total: 1000 },
      ],
    ];
    const ended = [
      { name: "A", total: 2500 },
      { name: "B", total: 4000 },
      { name: "C", total: 3000 },
    ];
    expect(unusualCategories(ended, base).map((u) => u.name)).toEqual([
      "B",
      "C",
    ]);
  });
});

describe("nextCycleAction", () => {
  const ok: BucketRow[] = [
    { bucket: "NEEDS", spent: 20000, budget: 25000 },
    { bucket: "WANTS", spent: 10000, budget: 15000 },
    { bucket: "SAVINGS", spent: 10000, budget: 10000 },
  ];

  it("rule 1: names the unusual category", () => {
    const a = nextCycleAction({
      unusual: [{ name: "Food Delivery", total: 3100, usual: 1200 }],
      buckets: ok,
      cycleDays: 30,
    });
    expect(a.text).toBe(
      "💡 Next cycle: keep Food Delivery near its usual ₹1,200 — that frees ₹1,900.",
    );
    expect(a.target).toEqual({
      kind: "category",
      name: "Food Delivery",
      limit: 1200,
    });
  });

  it("rule 2: the spending bucket with the largest overrun", () => {
    const a = nextCycleAction({
      unusual: [],
      buckets: [
        { bucket: "NEEDS", spent: 26000, budget: 25000 },
        { bucket: "WANTS", spent: 18000, budget: 15000 },
        { bucket: "SAVINGS", spent: 10000, budget: 10000 },
      ],
      cycleDays: 30,
    });
    expect(a.text).toBe(
      "💡 Next cycle: Wants ran ₹3,000 past budget — about ₹500/day keeps it on track.",
    );
    expect(a.target).toEqual({ kind: "bucket", bucket: "WANTS" });
  });

  it("rule 3: savings short", () => {
    const a = nextCycleAction({
      unusual: [],
      buckets: [
        ok[0]!,
        ok[1]!,
        { bucket: "SAVINGS", spent: 6000, budget: 10000 },
      ],
      cycleDays: 30,
    });
    expect(a.text).toBe(
      "💡 Next cycle: move ₹4,000 to savings on payday, before spending starts.",
    );
    expect(a.target).toEqual({ kind: "savings" });
  });

  it("rule 4: nothing to change", () => {
    const a = nextCycleAction({ unusual: [], buckets: ok, cycleDays: 30 });
    expect(a.text).toBe("💡 Next cycle: same plan — it worked.");
    expect(a.target).toEqual({ kind: "none" });
  });
});

describe("movers", () => {
  it("returns the biggest riser and faller across both cycles", () => {
    expect(
      movers(
        [
          { name: "Groceries", total: 8000 },
          { name: "Eating Out", total: 3000 },
        ],
        [
          { name: "Groceries", total: 9000 },
          { name: "Eating Out", total: 1500 },
        ],
      ),
    ).toEqual({
      up: { name: "Eating Out", delta: 1500 },
      down: { name: "Groceries", delta: -1000 },
    });
  });
});

describe("followUpLine", () => {
  const cat = { kind: "category", name: "Food Delivery", limit: 1200 } as const;
  const rows = (wants: number, savings: number): BucketRow[] => [
    { bucket: "NEEDS", spent: 20000, budget: 25000 },
    { bucket: "WANTS", spent: wants, budget: 15000 },
    { bucket: "SAVINGS", spent: savings, budget: 10000 },
  ];
  const ended = (total: number | null, wants = 10000, savings = 10000) => ({
    cats: total == null ? [] : [fd(total)],
    buckets: rows(wants, savings),
  });

  it("category within 10% of the limit is done", () => {
    expect(followUpLine(cat, ended(1300))).toBe(
      "✅ Last cycle's goal — Food Delivery near ₹1,200: done (₹1,300).",
    );
  });

  it("category above the limit reports what it came in at", () => {
    expect(followUpLine(cat, ended(2000))).toBe(
      "↗ Last cycle's goal — Food Delivery near ₹1,200: came in at ₹2,000.",
    );
  });

  it("a category with no spend this cycle counts as done at ₹0", () => {
    expect(followUpLine(cat, ended(null))).toBe(
      "✅ Last cycle's goal — Food Delivery near ₹1,200: done (₹0).",
    );
  });

  it("bucket within budget is done", () => {
    expect(
      followUpLine({ kind: "bucket", bucket: "WANTS" }, ended(0, 14000)),
    ).toBe("✅ Last cycle's goal — Wants within budget: done.");
  });

  it("bucket over budget reports the overrun", () => {
    expect(
      followUpLine({ kind: "bucket", bucket: "WANTS" }, ended(0, 18000)),
    ).toBe("↗ Last cycle's goal — Wants within budget: ran ₹3,000 past.");
  });

  it("savings target met is done", () => {
    expect(followUpLine({ kind: "savings" }, ended(0, 0, 10000))).toBe(
      "✅ Last cycle's goal — savings target: done.",
    );
  });

  it("savings short reports the shortfall", () => {
    expect(followUpLine({ kind: "savings" }, ended(0, 0, 6000))).toBe(
      "↗ Last cycle's goal — savings target: short by ₹4,000.",
    );
  });

  it("no target means no line", () => {
    expect(followUpLine({ kind: "none" }, ended(0))).toBeNull();
  });
});

describe("parseActionTarget", () => {
  it("accepts each stored target shape", () => {
    const targets = [
      { kind: "category", name: "Taxi", limit: 1000 },
      { kind: "bucket", bucket: "WANTS" },
      { kind: "savings" },
      { kind: "none" },
    ];
    for (const t of targets) expect(parseActionTarget(t)).toEqual(t);
  });

  it("rejects anything else, so a bad row never breaks a report", () => {
    expect(parseActionTarget(null)).toBeNull();
    expect(parseActionTarget({ kind: "category", name: "Taxi" })).toBeNull();
    expect(parseActionTarget({ kind: "bucket", bucket: "SAVINGS" })).toBeNull();
    expect(parseActionTarget({ kind: "teleport" })).toBeNull();
    expect(parseActionTarget("savings")).toBeNull();
  });
});
