import { describe, expect, it } from "vitest";
import {
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
