import { zonedBudgetPeriod, zonedPeriodDayInfo, zonedYmd } from "@/lib/time";

// How far into a cycle the prompt stays welcome. Past this the leftover has
// usually been spent anyway, and a blocking modal about it is just noise — the
// cycle is then skipped silently and the next one asks again.
export const CARRY_PROMPT_DAYS = 7;

export interface CarryPromptInput {
  // The cycle key the user last settled. Null = never settled.
  carryDecidedKey: string | null;
  payday: number;
  tz: string;
  userCreatedAt: Date;
  // Whether the previous cycle has any income or expenses at all. Nothing
  // logged means nothing to carry, and a brand-new account should not be
  // greeted by a question about money it has never seen.
  hadActivity: boolean;
  now?: Date;
}

// The cycle key to prompt for, or null to stay quiet. Kept Prisma-free so it can
// be unit-tested without a database or a request context, like lib/time.ts.
//
// Uses the tz-aware cycle helpers, not lib/budget.ts: the latter reads the
// server's clock (UTC on Railway), which would fire this on the wrong day for
// every user outside UTC.
export function shouldPromptCarry(input: CarryPromptInput): string | null {
  const now = input.now ?? new Date();
  const { start } = zonedBudgetPeriod(input.payday, input.tz, now);
  const cycleKey = zonedYmd(start, input.tz);

  if (input.carryDecidedKey === cycleKey) return null;
  if (!input.hadActivity) return null;
  // Signed up mid-cycle: the "previous cycle" is not theirs to carry.
  if (input.userCreatedAt >= start) return null;

  const { day } = zonedPeriodDayInfo(input.payday, input.tz, now);
  return day <= CARRY_PROMPT_DAYS ? cycleKey : null;
}
