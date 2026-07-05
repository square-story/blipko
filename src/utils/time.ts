// Timezone helpers so scheduling and day-math are computed in a user's local
// wall-clock instead of the server's clock. Uses Intl (no external deps).

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  weekday: string; // "Sun".."Sat"
}

function rawParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
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
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

// The UTC instant whose wall-clock in `tz` is (year, month1..12, day) 00:00:00.
// month is 1-based here to match zonedParts. (DST-transition midnights are an
// accepted edge; the default Asia/Kolkata has no DST.)
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
