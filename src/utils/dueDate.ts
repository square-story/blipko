export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

export function computeDueDatesInWindow(
  dayOfMonth: number,
  period: "MONTHLY" | "QUARTERLY",
  chargeStartDate: Date,
  chargeEndDate: Date | null,
  fromDate: Date,
  toDate: Date,
): Date[] {
  const step = period === "MONTHLY" ? 1 : 3;
  const dates: Date[] = [];

  let cursor = new Date(
    chargeStartDate.getFullYear(),
    chargeStartDate.getMonth(),
    dayOfMonth,
  );
  if (cursor < chargeStartDate) cursor = addMonths(cursor, step);

  while (cursor <= toDate) {
    if (cursor >= fromDate) {
      if (!chargeEndDate || cursor <= chargeEndDate) {
        dates.push(new Date(cursor));
      }
    }
    cursor = addMonths(cursor, step);
  }

  return dates;
}
