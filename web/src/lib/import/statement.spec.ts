import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { zonedYmd } from "@/lib/time";
import {
  defaultInclude,
  detectColumns,
  importDate,
  markDuplicates,
  parseAmount,
  parseStatementDate,
  payeeFromNarration,
  toTransactions,
} from "./statement";

const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

const importFixture = (name: string) => {
  const rows = parseCsv(fixture(name));
  const mapping = detectColumns(rows);
  expect(mapping).not.toBeNull();
  return toTransactions(rows, mapping!);
};

// Only the fields a fixture pins; narration is the raw cell and not repeated.
const brief = (t: ReturnType<typeof toTransactions>["txns"][number]) => ({
  date: t.date,
  amount: t.amount,
  kind: t.kind,
  payee: t.payee,
  cash: t.cash,
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("detects a tab-delimited file", () => {
    expect(parseCsv("a\tb,c\td\n1\t2\t3")).toEqual([
      ["a", "b,c", "d"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["31/12/26", "2026-12-31"],
    ["01/11/2026", "2026-11-01"],
    ["01-11-2026", "2026-11-01"],
    ["05-Nov-2026", "2026-11-05"],
    ["1 Nov 2026", "2026-11-01"],
    ["2026-11-05", "2026-11-05"],
  ])("reads %s day-first as %s", (raw, ymd) => {
    expect(parseStatementDate(raw)).toBe(ymd);
  });

  it.each(["", "Date", "13/13/2026", "31/02/2026", "TRANSACTION TOTAL"])(
    "rejects %s",
    (raw) => {
      expect(parseStatementDate(raw)).toBeNull();
    },
  );
});

describe("parseAmount", () => {
  it.each([
    ["1,234.50", 1234.5],
    ["1,234.50 Dr", 1234.5],
    ["₹ 649", 649],
    ["0.00", 0],
    ["", null],
    ["-", null],
  ])("reads %s", (raw, n) => {
    expect(parseAmount(raw)).toBe(n);
  });
});

describe("payeeFromNarration", () => {
  it.each([
    [
      "UPI-SWIGGY-SWIGGY8@YBL-YESB0YBLUPI-631234567890-PAYMENT FROM PHONE",
      "Swiggy",
    ],
    ["POS 512345XXXXXX1234 AMAZON PAY INDIA", "Amazon Pay India"],
    [
      "NEFT CR-HDFC0000001-ACME TECHNOLOGIES PVT LTD-SALARY NOV",
      "Acme Technologies",
    ],
    [
      "UPI/631234567898/Payment from Ph/swiggy8@ybl/YES BANK LIMITED YBS/",
      "Swiggy",
    ],
    [
      "UPI/631234567899/Sent via app/ramesh.k@okhdfcbank/HDFC BANK LTD/",
      "Ramesh K",
    ],
    ["MMT/IMPS/631234567800/REFUND/MAKEMYTRIP/ICIC0000001", "Makemytrip"],
    [
      "TO TRANSFER-UPI/DR/631234567895/BIGBASKET/YESB/bigbasket@ybl/Payment--",
      "Bigbasket",
    ],
  ])("%s → %s", (narration, payee) => {
    expect(payeeFromNarration(narration)).toBe(payee);
  });

  it("caps the payee at the note limit", () => {
    expect(payeeFromNarration("A".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("detectColumns", () => {
  it("skips the preamble to find the header row", () => {
    const m = detectColumns(parseCsv(fixture("hdfc.csv")));
    expect(m).toEqual({
      headerRow: 4,
      date: 0,
      description: 1,
      debit: 4,
      credit: 5,
    });
  });

  it("prefers the transaction date over the value date", () => {
    expect(detectColumns(parseCsv(fixture("icici.csv")))!.date).toBe(2);
  });

  it("maps a single amount column with a Dr/Cr type column", () => {
    const rows = parseCsv(
      "Sl. No.,Transaction Date,Value Date,Description,Chq / Ref No.,Amount,Dr / Cr,Balance,Dr / Cr\n" +
        "1,03-11-2026,03-11-2026,UPI/RAPIDO/ride,,89.00,DR,100.00,CR\n" +
        "2,04-11-2026,04-11-2026,UPI/ANITA/gift,,500.00,CR,600.00,CR",
    );
    const m = detectColumns(rows)!;
    expect(m).toEqual({
      headerRow: 0,
      date: 1,
      description: 3,
      amount: 5,
      type: 6,
    });
    expect(toTransactions(rows, m).txns.map(brief)).toEqual([
      {
        date: "2026-11-03",
        amount: 89,
        kind: "DEBIT",
        payee: "Rapido",
        cash: false,
      },
      {
        date: "2026-11-04",
        amount: 500,
        kind: "CREDIT",
        payee: "Anita",
        cash: false,
      },
    ]);
  });

  it("returns null for a layout it can't read, so the user maps it", () => {
    expect(
      detectColumns(parseCsv("when,what,how much\n1/1/26,x,10")),
    ).toBeNull();
  });
});

describe("bank fixtures", () => {
  it("HDFC", () => {
    const { txns, skipped } = importFixture("hdfc.csv");
    expect(skipped).toBe(0);
    expect(txns.map(brief)).toEqual([
      {
        date: "2026-11-01",
        amount: 250,
        kind: "DEBIT",
        payee: "Swiggy",
        cash: false,
      },
      {
        date: "2026-11-02",
        amount: 600,
        kind: "CREDIT",
        payee: "Rahul Kumar",
        cash: false,
      },
      {
        date: "2026-11-03",
        amount: 1499,
        kind: "DEBIT",
        payee: "Amazon Pay India",
        cash: false,
      },
      {
        date: "2026-11-04",
        amount: 2000,
        kind: "DEBIT",
        payee: "Cash withdrawal",
        cash: true,
      },
      {
        date: "2026-11-05",
        amount: 85000,
        kind: "CREDIT",
        payee: "Acme Technologies",
        cash: false,
      },
      {
        date: "2026-11-06",
        amount: 1240.5,
        kind: "DEBIT",
        payee: "Zomato",
        cash: false,
      },
      {
        date: "2026-11-07",
        amount: 649,
        kind: "DEBIT",
        payee: "Netflix",
        cash: false,
      },
      {
        date: "2026-12-31",
        amount: 312,
        kind: "DEBIT",
        payee: "Uber India",
        cash: false,
      },
    ]);
  });

  it("SBI (tab-delimited)", () => {
    const { txns } = importFixture("sbi.csv");
    expect(txns.map(brief)).toEqual([
      {
        date: "2026-11-01",
        amount: 1830,
        kind: "DEBIT",
        payee: "Bigbasket",
        cash: false,
      },
      {
        date: "2026-11-02",
        amount: 5000,
        kind: "CREDIT",
        payee: "Priya S",
        cash: false,
      },
      {
        date: "2026-11-03",
        amount: 299,
        kind: "DEBIT",
        payee: "Jio",
        cash: false,
      },
      {
        date: "2026-11-04",
        amount: 3000,
        kind: "DEBIT",
        payee: "Cash withdrawal",
        cash: true,
      },
    ]);
  });

  it("ICICI (0.00 in the unused column)", () => {
    const { txns } = importFixture("icici.csv");
    expect(txns.map(brief)).toEqual([
      {
        date: "2026-11-01",
        amount: 450,
        kind: "DEBIT",
        payee: "Swiggy",
        cash: false,
      },
      {
        date: "2026-11-02",
        amount: 120,
        kind: "DEBIT",
        payee: "Ramesh K",
        cash: false,
      },
      {
        date: "2026-11-03",
        amount: 2500,
        kind: "CREDIT",
        payee: "Makemytrip",
        cash: false,
      },
      {
        date: "2026-11-05",
        amount: 1105,
        kind: "DEBIT",
        payee: "Blinkit",
        cash: false,
      },
    ]);
  });

  it("Axis (skips the opening balance and the totals row)", () => {
    const { txns, skipped } = importFixture("axis.csv");
    expect(skipped).toBe(2);
    expect(txns.map(brief)).toEqual([
      {
        date: "2026-11-01",
        amount: 2345,
        kind: "DEBIT",
        payee: "Dmart Avenue Supermarts",
        cash: false,
      },
      {
        date: "2026-11-02",
        amount: 1000,
        kind: "CREDIT",
        payee: "Anita Dsouza",
        cash: false,
      },
      {
        date: "2026-11-03",
        amount: 1000,
        kind: "DEBIT",
        payee: "Cash withdrawal",
        cash: true,
      },
      {
        date: "2026-11-04",
        amount: 89,
        kind: "DEBIT",
        payee: "Rapido",
        cash: false,
      },
    ]);
  });
});

describe("markDuplicates", () => {
  const t = (
    date: string,
    amount: number,
    kind: "DEBIT" | "CREDIT" = "DEBIT",
  ) => ({ date, amount, kind, narration: "", payee: "", cash: false }) as const;

  it("lets each logged row absorb only one statement row", () => {
    expect(
      markDuplicates(
        [t("2026-11-01", 20), t("2026-11-01", 20)],
        [{ date: "2026-11-01", amount: 20, kind: "DEBIT" }],
      ),
    ).toEqual([true, false]);
  });

  // Bot-logged at 11:50 pm, posted by the bank the next morning.
  it("matches across a one-day gap but not two", () => {
    const logged = [
      { date: "2026-11-01", amount: 250, kind: "DEBIT" as const },
    ];
    expect(markDuplicates([t("2026-11-02", 250)], logged)).toEqual([true]);
    expect(markDuplicates([t("2026-11-03", 250)], logged)).toEqual([false]);
  });

  // Logged chai on the 1st; the statement has a ₹20 on the 2nd (listed first)
  // and on the 1st. The 1st is the one already logged.
  it("prefers a same-day match before reaching across a day", () => {
    expect(
      markDuplicates(
        [t("2026-11-02", 20), t("2026-11-01", 20)],
        [{ date: "2026-11-01", amount: 20, kind: "DEBIT" }],
      ),
    ).toEqual([false, true]);
  });

  it("never matches an expense against income", () => {
    expect(
      markDuplicates(
        [t("2026-11-01", 500, "CREDIT")],
        [{ date: "2026-11-01", amount: 500, kind: "DEBIT" }],
      ),
    ).toEqual([false]);
  });

  it("matches to the paisa", () => {
    expect(
      markDuplicates(
        [t("2026-11-01", 1240.5)],
        [{ date: "2026-11-01", amount: 1240, kind: "DEBIT" }],
      ),
    ).toEqual([false]);
  });

  it("flags a whole re-imported file", () => {
    const { txns } = importFixture("hdfc.csv");
    const logged = txns.map(({ date, amount, kind }) => ({
      date,
      amount,
      kind,
    }));
    expect(markDuplicates(txns, logged).every(Boolean)).toBe(true);
  });
});

describe("importDate", () => {
  // Noon in the user's zone: no offset can push it onto another calendar day.
  it.each(["Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"])(
    "keeps the statement's day in %s",
    (tz) => {
      expect(zonedYmd(importDate("2026-11-01", tz), tz)).toBe("2026-11-01");
    },
  );

  it("is noon IST for an Indian user", () => {
    expect(importDate("2026-11-01", "Asia/Kolkata").toISOString()).toBe(
      "2026-11-01T06:30:00.000Z",
    );
  });
});

describe("defaultInclude", () => {
  const t = (kind: "DEBIT" | "CREDIT", cash = false) =>
    ({
      date: "2026-11-01",
      amount: 1,
      kind,
      narration: "",
      payee: "",
      cash,
    }) as const;

  it("ticks only new, non-cash spends", () => {
    expect(defaultInclude(t("DEBIT"), false)).toBe(true);
    expect(defaultInclude(t("DEBIT"), true)).toBe(false);
    expect(defaultInclude(t("DEBIT", true), false)).toBe(false);
    expect(defaultInclude(t("CREDIT"), false)).toBe(false);
  });
});
