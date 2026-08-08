// Builds links from a chart into the filtered transaction table.
//
// The encoding is exact rather than approximate, and easy to get wrong:
//
//   bucket / categoryId  dot-joined multi-value. buildWhere in
//                        lib/actions/expenses.ts does `bucket.split(".")`, so a
//                        comma-joined list silently matches nothing.
//   from / to            epoch milliseconds as strings. buildWhere applies
//                        `lte: new Date(Number(to) + 86_399_999)`, i.e. `to` is
//                        an inclusive day, not an instant.
//
// Because `to` is widened by a day-minus-1ms, passing the cycle's end instant
// would pull in the first day of the next cycle. Passing `end - 1 day` makes
// the closed range [from, to] exactly the half-open cycle [start, end).
//
// The dashboard already emits this shape by hand (dashboard/page.tsx, cycleQs);
// this is that convention in one place.

import type { Bucket } from "@prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DrilldownFilters {
  /** Cycle bounds, half-open [start, end). Converted to the table's encoding. */
  from?: Date | number;
  to?: Date | number;
  buckets?: Bucket[];
  categoryIds?: string[];
  search?: string;
}

function ms(v: Date | number): number {
  return v instanceof Date ? v.getTime() : v;
}

export function expensesHref(filters: DrilldownFilters = {}): string {
  const qs = new URLSearchParams();

  if (filters.from !== undefined) qs.set("from", String(ms(filters.from)));
  if (filters.to !== undefined) {
    // Caller passes the exclusive cycle end; step back a day so buildWhere's
    // +86_399_999 lands on end-1ms rather than a day into the next cycle.
    qs.set("to", String(ms(filters.to) - MS_PER_DAY));
  }
  if (filters.buckets?.length) qs.set("bucket", filters.buckets.join("."));
  if (filters.categoryIds?.length) {
    qs.set("categoryId", filters.categoryIds.join("."));
  }
  if (filters.search) qs.set("search", filters.search);

  const s = qs.toString();
  return s ? `/dashboard/expenses?${s}` : "/dashboard/expenses";
}

// Sentinel for expenses whose category was deleted (deleteCategory nulls
// expense.categoryId). buildWhere can only express `categoryId: { in: [...] }`,
// so there is no way to ask for NULL — these slices render unlinked rather than
// pointing at a filter that would quietly return everything.
export const UNCATEGORIZED_ID = "__uncategorized__";

export function categoryHref(
  categoryId: string | null,
  cycle?: { start: Date; end: Date },
): string | null {
  if (!categoryId || categoryId === UNCATEGORIZED_ID) return null;
  return expensesHref({
    categoryIds: [categoryId],
    from: cycle?.start,
    to: cycle?.end,
  });
}
