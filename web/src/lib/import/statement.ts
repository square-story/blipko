import { zonedStartOfDayUtc } from "@/lib/time";

// Bank statement → transactions. Pure (no Prisma, no Next) so it runs in the
// browser and under vitest. Header detection by column name replaces per-bank
// presets: Indian banks mostly differ in what they call the same columns.

export interface StatementTxn {
  date: string; // YYYY-MM-DD as printed on the statement
  amount: number;
  kind: "DEBIT" | "CREDIT";
  narration: string;
  payee: string;
  cash: boolean; // ATM / cash withdrawal
  cardBill: boolean; // credit-card bill payment
}

export interface Mapping {
  headerRow: number;
  date: number;
  description: number;
  // Either split debit/credit columns…
  debit?: number;
  credit?: number;
  // …or one amount column with a Dr/Cr type column.
  amount?: number;
  type?: number;
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

// Day-first: these are Indian statements, so 05/11 is 5 November.
export function parseStatementDate(raw: string): string | null {
  // A trailing time ("10:32", "11:30 PM", "T10:32:00") — Excel's Save As CSV
  // writes datetimes — says nothing about the day.
  const s = (raw ?? "")
    .trim()
    .replace(/[ T,]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*([ap]m)?$/i, "");
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const dmy =
    /^(\d{1,2})[/\-. ]([A-Za-z]{3,4}|\d{1,2})[/\-. ](\d{4}|\d{2})$/.exec(s);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    d = Number(dmy[1]);
    const mon = dmy[2]!;
    m = /\d/.test(mon)
      ? Number(mon)
      : MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
    y = Number(dmy[3]);
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  // Round-trip through a UTC date so 31/02 or 13/13 is rejected, not rolled.
  const t = new Date(Date.UTC(y, m - 1, d));
  if (
    m < 1 ||
    t.getUTCFullYear() !== y ||
    t.getUTCMonth() !== m - 1 ||
    t.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

// "1,234.50", "1,234.50 Dr", "₹ 649" → number; blank or "-" → null.
export function parseAmount(raw: string): number | null {
  const s = (raw ?? "")
    .replace(/₹|INR|Rs\.?/gi, "")
    .replace(/\b(dr|cr)\b\.?/gi, "")
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const CASH = /\b(ATM|ATW|NWD|CASH WDL)\b/i;
// Paying a card bill repays spends already logged when they were made.
const CARD_BILL =
  /credit\s*card|\bcc\b|card\s*(bill|payment)|autopay|\bcred\b/i;
// Rails, directions and channel codes: never the payee.
const STOP = new Set([
  "upi",
  "dr",
  "cr",
  "p2m",
  "p2a",
  "pos",
  "neft",
  "imps",
  "rtgs",
  "mmt",
  "to",
  "by",
  "transfer",
  "atw",
  "nwd",
  "ach",
  "ecs",
  "nach",
  "inb",
  "onl",
]);
// A token that is a remark, not a name ("Payment from Ph", "Sent via app").
const GENERIC = /^(payment|paid|pay to|pay|sent|upi|refund|ref)\b/i;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const CORP = /\b(pvt|private|ltd|limited|llp|inc)\b\.?/gi;
const MAX_PAYEE = 100; // the expense note limit

const letters = (s: string) => s.match(/\p{L}/gu)?.length ?? 0;
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

// The name the money went to, from a narration like
// "UPI-SWIGGY-SWIGGY8@YBL-YESB0YBLUPI-631234567890-PAYMENT FROM PHONE".
// First real name wins; a VPA's handle is the fallback when the bank printed
// only remarks around it (ICICI: "UPI/…/Payment from Ph/swiggy8@ybl/YES BANK").
export function payeeFromNarration(narration: string): string {
  let vpa: string | null = null;
  for (const raw of narration.split(/[/-]+/)) {
    const token = raw.trim();
    if (!token) continue;
    if (token.includes("@")) {
      vpa ??= token;
      continue;
    }
    if (IFSC.test(token) || /bank/i.test(token) || GENERIC.test(token)) {
      continue;
    }
    const name = token
      .split(/\s+/)
      .filter((w) => !STOP.has(w.toLowerCase()) && !/\d/.test(w))
      .join(" ")
      .replace(CORP, "")
      .replace(/\s+/g, " ")
      .trim();
    if (letters(name) >= 3) return titleCase(name).slice(0, MAX_PAYEE);
  }
  if (vpa) {
    const handle = vpa
      .split("@")[0]!
      .replace(/[^\p{L}]+/gu, " ")
      .trim();
    if (letters(handle) >= 3) return titleCase(handle).slice(0, MAX_PAYEE);
  }
  return narration.trim().slice(0, MAX_PAYEE) || "Unknown";
}

const DATE_COL = /date/;
const TXN_DATE = /txn|tran|transaction|posting/;
const DESC_COL = /narration|description|particulars|remarks|details/;
const DEBIT_COL = /withdrawal|debit|^dr\.?$/;
const CREDIT_COL = /deposit|credit|^cr\.?$/;
const TYPE_COL = /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|txn type)$/;
const AMOUNT_COL = /^amount\b/;
const HEADER_SCAN = 40;

// The first row (within the first 40) that names a date, a description and
// money columns. null → the UI asks the user to map columns by hand.
export function detectColumns(rows: string[][]): Mapping | null {
  for (let r = 0; r < Math.min(rows.length, HEADER_SCAN); r++) {
    const cells = rows[r]!.map((c) => c.trim().toLowerCase());
    const find = (re: RegExp, from = 0) =>
      cells.findIndex((c, i) => i >= from && re.test(c));

    const dates = cells
      .map((c, i) => (DATE_COL.test(c) ? i : -1))
      .filter((i) => i >= 0);
    if (dates.length === 0) continue;
    const date =
      dates.find((i) => TXN_DATE.test(cells[i]!)) ??
      dates.find((i) => !/value/.test(cells[i]!)) ??
      dates[0]!;
    const description = find(DESC_COL);
    if (description < 0) continue;

    const debit = find(DEBIT_COL);
    const credit = find(CREDIT_COL);
    if (debit >= 0 && credit >= 0) {
      return { headerRow: r, date, description, debit, credit };
    }
    const amount = find(AMOUNT_COL);
    // The type column right after the amount — Kotak prints a second
    // "Dr / Cr" after the balance, which describes the balance.
    const type = amount >= 0 ? find(TYPE_COL, amount + 1) : -1;
    if (amount >= 0 && type >= 0) {
      return { headerRow: r, date, description, amount, type };
    }
  }
  return null;
}

// Rows below the header become transactions. Rows that carry content but no
// usable date or amount (opening balance, totals) are counted as skipped;
// blank lines are ignored.
export function toTransactions(
  rows: string[][],
  m: Mapping,
): { txns: StatementTxn[]; skipped: number } {
  const txns: StatementTxn[] = [];
  let skipped = 0;
  for (const row of rows.slice(m.headerRow + 1)) {
    if (row.every((c) => c.trim() === "")) continue;
    const date = parseStatementDate(row[m.date] ?? "");
    let amount: number | null = null;
    let kind: StatementTxn["kind"] = "DEBIT";
    if (m.debit !== undefined && m.credit !== undefined) {
      const dr = parseAmount(row[m.debit] ?? "");
      const cr = parseAmount(row[m.credit] ?? "");
      if (dr) amount = dr;
      else if (cr) [amount, kind] = [cr, "CREDIT"];
    } else if (m.amount !== undefined && m.type !== undefined) {
      const type = (row[m.type] ?? "").trim().toLowerCase();
      amount = parseAmount(row[m.amount] ?? "");
      if (type.startsWith("cr")) kind = "CREDIT";
      else if (!type.startsWith("dr")) amount = null;
    }
    if (!date || !amount) {
      skipped++;
      continue;
    }
    const narration = (row[m.description] ?? "").trim();
    const cash = CASH.test(narration);
    txns.push({
      date,
      amount,
      kind,
      narration,
      payee: cash ? "Cash withdrawal" : payeeFromNarration(narration),
      cash,
      cardBill: CARD_BILL.test(narration),
    });
  }
  return { txns, skipped };
}

export interface LoggedRow {
  date: string; // YYYY-MM-DD in the user's timezone
  amount: number;
  kind: StatementTxn["kind"];
}

const dayNumber = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000;

// Which statement rows are probably already logged: same kind, same amount to
// the paisa, dates at most a day apart. One-to-one — each logged row absorbs
// one statement row, so two ₹20 chais against one logged ₹20 leaves one new.
// Payee is deliberately not compared: the bot has "lunch 250" where the bank
// says "Swiggy", and missing that match would count the money twice. Same-day
// matches are claimed first so a ±1 match can't steal another row's partner.
export function markDuplicates(
  txns: Pick<StatementTxn, "date" | "amount" | "kind">[],
  logged: LoggedRow[],
): boolean[] {
  const used = new Array<boolean>(logged.length).fill(false);
  const dup = new Array<boolean>(txns.length).fill(false);
  for (const window of [0, 1]) {
    txns.forEach((t, i) => {
      if (dup[i]) return;
      const day = dayNumber(t.date);
      const j = logged.findIndex(
        (l, k) =>
          !used[k] &&
          l.kind === t.kind &&
          Math.round(l.amount * 100) === Math.round(t.amount * 100) &&
          Math.abs(dayNumber(l.date) - day) <= window,
      );
      if (j >= 0) {
        used[j] = true;
        dup[i] = true;
      }
    });
  }
  return dup;
}

// The instant a statement row is stored at: noon on its day in the user's
// zone. A statement has dates, not times, and noon is the hour no timezone
// offset can push onto a neighbouring day.
export function importDate(ymd: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(zonedStartOfDayUtc(y, m, d, tz).getTime() + 12 * 3_600_000);
}

// What the preview ticks by default. Credits stay unticked (salary is usually
// already logged; transfers and refunds would raise the budget), and so do
// cash withdrawals: the cash is spent later and logged then.
export function defaultInclude(
  txn: Pick<StatementTxn, "kind" | "cash" | "cardBill">,
  duplicate: boolean,
): boolean {
  return txn.kind === "DEBIT" && !txn.cash && !txn.cardBill && !duplicate;
}
