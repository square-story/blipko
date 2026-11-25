import { describe, it, expect, vi } from "vitest";
import {
  balanceVerdict,
  expectedBalance,
  parseBalanceText,
} from "./balanceCheck";

describe("balanceVerdict", () => {
  it("calls a small gap a match", () => {
    expect(balanceVerdict(9200, 9150)).toEqual({ gap: 50, verdict: "MATCH" });
  });
  it("flags money that went out unlogged", () => {
    expect(balanceVerdict(9200, 7000)).toEqual({
      gap: 2200,
      verdict: "MISSING",
    });
  });
  it("flags more money than expected", () => {
    expect(balanceVerdict(9200, 10700)).toEqual({
      gap: -1500,
      verdict: "EXTRA",
    });
  });
  it("scales the tolerance to 1% of a large balance", () => {
    expect(balanceVerdict(50000, 49600).verdict).toBe("MATCH");
  });
});

describe("parseBalanceText", () => {
  it.each([
    ["/balance 12400", 12400],
    ["balance ₹12,400", 12400],
    ["my balance is 12400", 12400],
    ["bank balance: 12400", 12400],
    ["bal 500", 500],
    ["Balance 9000", 9000],
    ["balance 12,400/-", 12400],
  ])("reads %s", (text, amount) => {
    expect(parseBalanceText(text)).toEqual({ amount });
  });

  it("treats a bare /balance as a request without a figure", () => {
    expect(parseBalanceText("/balance")).toEqual({ amount: null });
    expect(parseBalanceText("balance")).toEqual({ amount: null });
  });

  // Claimed but not readable: these must never fall through to the parser,
  // which has no balance concept and could log "balance 12k" as a spend.
  it.each(["balance -500", "bal 12k", "my balance is ₹12.4k"])(
    "claims %s but asks for a plain number",
    (text) => {
      expect(parseBalanceText(text)).toEqual({ amount: null, invalid: true });
    },
  );

  it.each(["chai 30", "balance sheet review", "balanced diet 200", "undo"])(
    "leaves %s to the parser",
    (text) => {
      expect(parseBalanceText(text)).toBeNull();
    },
  );
});

describe("expectedBalance", () => {
  const from = new Date("2026-11-10T06:30:00Z");
  const now = new Date("2026-11-17T06:30:00Z");
  const user = { id: "u1", balanceAnchor: "10000.00", balanceAnchorAt: from };

  const deps = () => ({
    incomeRepository: {
      sumForMonth: vi.fn().mockResolvedValue(6000),
      sumCarryForMonth: vi.fn().mockResolvedValue(1000),
    },
    expenseRepository: {
      sumByBucketForMonth: vi.fn(async (_u: string, b: string) =>
        b === "SAVINGS" ? 1500 : 1000,
      ),
      sumByCategoryForMonth: vi.fn().mockResolvedValue(1500),
    },
    categoryRepository: {
      findByNameForUser: vi
        .fn()
        .mockResolvedValue({ id: "carry", name: "Carried Forward" }),
    },
    boxRepository: {
      sumMovedSince: vi.fn().mockResolvedValue({ spent: 300, income: 200 }),
    },
  });

  // income 6000 − carry 1000 + 200 moved into a box = 5200; spend
  // 1000+1000+1500 − carried 1500 = 2000, + 300 moved to a box = 2300;
  // 10000 + 5200 − 2300 = 12900.
  it("leaves carry bookkeeping out and counts money moved into boxes", async () => {
    const d = deps();
    const r = await expectedBalance(d, user, now);
    expect(r).toEqual({
      anchor: 10000,
      anchorAt: from,
      income: 5200,
      spent: 2300,
      expected: 12900,
    });
    expect(d.expenseRepository.sumByCategoryForMonth).toHaveBeenCalledWith(
      "u1",
      "carry",
      from,
      now,
    );
    expect(d.boxRepository.sumMovedSince).toHaveBeenCalledWith("u1", from, now);
  });

  it("subtracts nothing for a carry category the user never got", async () => {
    const d = deps();
    d.categoryRepository.findByNameForUser.mockResolvedValue(null);
    const r = await expectedBalance(d, user, now);
    expect(r!.spent).toBe(3800);
    expect(d.expenseRepository.sumByCategoryForMonth).not.toHaveBeenCalled();
  });

  it("returns null before the first balance is saved", async () => {
    expect(
      await expectedBalance(
        deps(),
        { id: "u1", balanceAnchor: null, balanceAnchorAt: null },
        now,
      ),
    ).toBeNull();
  });
});
