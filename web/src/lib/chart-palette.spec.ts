import { describe, expect, it } from "vitest";
import { toneForBucket, toneForSpend } from "./chart-palette";

describe("toneForSpend", () => {
  it("escalates as a cap is approached and passed", () => {
    expect(toneForSpend(0)).toBe("positive");
    expect(toneForSpend(79)).toBe("positive");
    expect(toneForSpend(80)).toBe("caution");
    expect(toneForSpend(99)).toBe("caution");
    expect(toneForSpend(100)).toBe("negative");
    expect(toneForSpend(242)).toBe("negative");
  });
});

describe("toneForBucket", () => {
  // The regression this exists for: the analytics Overview arcs ran
  // toneForSpend over every bucket, so hitting a savings target rendered the
  // gauge red — the single best outcome shown as the worst. Real data never
  // caught it because that account's Savings bucket sits at 67%.
  it("does not paint a met savings target as a failure", () => {
    expect(toneForBucket("SAVINGS", 100)).toBe("positive");
    expect(toneForBucket("SAVINGS", 150)).toBe("positive");
    expect(toneForBucket("SAVINGS", 242)).toBe("positive");
  });

  it("has no caution band for savings — 90% saved is not a warning", () => {
    expect(toneForBucket("SAVINGS", 80)).toBe("primary");
    expect(toneForBucket("SAVINGS", 90)).toBe("primary");
    expect(toneForBucket("SAVINGS", 99)).toBe("primary");
  });

  it("treats savings below target as neutral progress, not success", () => {
    // "positive" here would claim the goal is met when it is not.
    expect(toneForBucket("SAVINGS", 0)).toBe("primary");
    expect(toneForBucket("SAVINGS", 50)).toBe("primary");
  });

  it("keeps the spend thresholds for NEEDS and WANTS", () => {
    for (const bucket of ["NEEDS", "WANTS"] as const) {
      expect(toneForBucket(bucket, 50)).toBe("positive");
      expect(toneForBucket(bucket, 80)).toBe("caution");
      expect(toneForBucket(bucket, 100)).toBe("negative");
      expect(toneForBucket(bucket, 143)).toBe("negative");
    }
  });

  it("disagrees with toneForSpend exactly where savings is concerned", () => {
    // Documents why the two functions both exist.
    expect(toneForBucket("NEEDS", 120)).toBe(toneForSpend(120));
    expect(toneForBucket("SAVINGS", 120)).not.toBe(toneForSpend(120));
  });
});
