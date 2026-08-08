// Timezone-aware cycle math for the analytics surface.
//
// `lib/budget.ts` builds cycle bounds with `new Date(y, m, d)`, which reads the
// *server's* clock. On Railway no TZ is set, so containers run UTC: an IST
// user's expense logged at 02:00 on payday lands in the previous cycle. This is
// the same bug commit 7470e64 fixed in the bot (src/utils/time.ts); the web app
// never got the fix.
//
// These helpers are a port of `src/utils/time.ts` + the cycle math in
// `src/application/use-cases/budgetMath.ts`, with two deliberate changes:
//
//   1. `tz` is a required second argument rather than a defaulted last one.
//      Every web caller has a real `user.timezone`; defaulting it is how you
//      silently get server-local math back.
//   2. The Intl formatters are memoized. The backend constructs a new
//      `Intl.DateTimeFormat` per call, which is fine for a few calls per cron
//      tick but not for the weekday histogram, which runs once per expense row.
//
// `lib/budget.ts` is intentionally left alone — the dashboard, categories and
// boxes routes all depend on its current server-local behaviour, and changing
// it is a separate, wider migration.

export const DEFAULT_TZ = "Asia/Kolkata";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  weekday: string; // "Sun".."Sat"
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const ymdFormatters = new Map<string, Intl.DateTimeFormat>();
const labelFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

function rawParts(date: Date, tz: string) {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(date)) {
    p[part.type] = part.value;
  }
  let hour = Number(p.hour);
  if (hour === 24) hour = 0; // some engines emit "24" at midnight
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: p.weekday ?? "",
  };
}

// The wall-clock parts of `date` in the given IANA timezone.
export function zonedParts(date: Date, tz: string): ZonedParts {
  const p = rawParts(date, tz);
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    weekday: p.weekday,
  };
}

// "YYYY-MM-DD" of `date` in the given timezone.
export function zonedYmd(date: Date, tz: string): string {
  let f = ymdFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    ymdFormatters.set(tz, f);
  }
  return f.format(date);
}

export function zonedWeekday(date: Date, tz: string): string {
  return rawParts(date, tz).weekday;
}

export function zonedHour(date: Date, tz: string): number {
  return rawParts(date, tz).hour;
}

// Offset (ms) that `tz` is ahead of UTC at the given instant.
function tzOffsetMs(instant: Date, tz: string): number {
  const p = rawParts(instant, tz);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - instant.getTime();
}

// The UTC instant whose wall-clock in `tz` is (year, month 1..12, day) 00:00.
// `month` may be 0 or 13 — Date.UTC normalizes into the adjacent year, which is
// what the cycle helpers below rely on when stepping across a year boundary.
// (DST-transition midnights are an accepted edge; Asia/Kolkata has no DST.)
export function zonedStartOfDayUtc(
  year: number,
  month: number,
  day: number,
  tz: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offset);
}

// Clamp a payday to a safe 1–28 (no Feb/30-day edge cases). Mirrors the schema
// constraint and the bot's clampPayday.
function clampPayday(payday: number): number {
  return Math.min(Math.max(Math.floor(payday) || 1, 1), 28);
}

export interface CycleBounds {
  start: Date;
  end: Date;
}

// The current budget cycle [start, end): most recent payday on/before `now` to
// the next payday, resolved in the user's timezone. payday=1 reproduces the
// calendar month.
export function zonedBudgetPeriod(
  payday: number,
  tz: string,
  now: Date = new Date(),
): CycleBounds {
  const d = clampPayday(payday);
  const { year: y, month: m, day } = zonedParts(now, tz); // month is 1-12
  if (day >= d) {
    return {
      start: zonedStartOfDayUtc(y, m, d, tz),
      end: zonedStartOfDayUtc(y, m + 1, d, tz),
    };
  }
  return {
    start: zonedStartOfDayUtc(y, m - 1, d, tz),
    end: zonedStartOfDayUtc(y, m, d, tz),
  };
}

// The `n` most recent COMPLETE cycles (excludes the current partial one),
// newest first. Steps back one cycle at a time so 28–31-day months are handled.
export function zonedPreviousCycles(
  payday: number,
  n: number,
  tz: string,
  now: Date = new Date(),
): CycleBounds[] {
  const out: CycleBounds[] = [];
  let ref = zonedBudgetPeriod(payday, tz, now).start;
  for (let i = 0; i < n; i++) {
    const prev = zonedBudgetPeriod(
      payday,
      tz,
      new Date(ref.getTime() - MS_PER_DAY),
    );
    out.push(prev);
    ref = prev.start;
  }
  return out;
}

export interface ZonedPeriodDayInfo {
  day: number; // 1-based day within the cycle
  daysInPeriod: number;
  remainingDays: number; // days left including today (>= 1)
}

// Where we are in the current cycle. Mirrors budgetMath.periodDayInfo.
export function zonedPeriodDayInfo(
  payday: number,
  tz: string,
  now: Date = new Date(),
): ZonedPeriodDayInfo {
  const { start, end } = zonedBudgetPeriod(payday, tz, now);
  const daysInPeriod = Math.round(
    (end.getTime() - start.getTime()) / MS_PER_DAY,
  );
  const day = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return {
    day,
    daysInPeriod,
    remainingDays: Math.max(1, daysInPeriod - day + 1),
  };
}

// Short label for a cycle, e.g. "Jul 25". Formatted in the user's timezone and
// locale — analytics.ts previously hardcoded "en-IN" and no timeZone, so a
// cycle starting at IST midnight rendered under the previous month on a UTC
// server.
export function cycleLabel(start: Date, tz: string, locale: string): string {
  const key = `${tz}|${locale}`;
  let f = labelFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      month: "short",
      year: "2-digit",
    });
    labelFormatters.set(key, f);
  }
  return f.format(start);
}

export interface CycleWindow extends CycleBounds {
  key: string; // zonedYmd(start) — stable React key
  label: string;
  days: number;
}

// The `n` most recent cycles, OLDEST FIRST, with the current partial cycle last.
// This is the x-axis of every cycle-series chart.
export function zonedCycleWindows(
  payday: number,
  n: number,
  tz: string,
  locale: string,
  now: Date = new Date(),
): CycleWindow[] {
  const count = Math.max(1, Math.floor(n) || 1);
  const current = zonedBudgetPeriod(payday, tz, now);
  // `count - 1` complete cycles behind us, newest first, then the current one.
  const bounds = [
    ...zonedPreviousCycles(payday, count - 1, tz, now).reverse(),
    current,
  ];
  return bounds.map((b) => ({
    ...b,
    key: zonedYmd(b.start, tz),
    label: cycleLabel(b.start, tz, locale),
    days: Math.round((b.end.getTime() - b.start.getTime()) / MS_PER_DAY),
  }));
}

// Maps a date to its index in `windows`, or -1 if outside the range. Binary
// search over precomputed epoch bounds — deliberately no Intl per row, so
// bucketing thousands of expenses stays cheap.
export function cycleIndexer(windows: CycleWindow[]): (date: Date) => number {
  const starts = windows.map((w) => w.start.getTime());
  const lastEnd = windows.length
    ? windows[windows.length - 1]!.end.getTime()
    : 0;

  return (date: Date) => {
    const t = date.getTime();
    if (!windows.length || t < starts[0]! || t >= lastEnd) return -1;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
}
