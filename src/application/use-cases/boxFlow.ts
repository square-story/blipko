import { Box, BoxEntryDirection, BoxEntrySource } from "@prisma/client";
import { IBoxRepository } from "../../domain/repositories/IBoxRepository";
import { formatMoney, sanitizeMd } from "./budgetMath";

// One line summarising a box's balance and progress toward its target (if any).
export function boxProgressLine(box: Box, balance: number): string {
  const bal = formatMoney(balance);
  if (box.targetAmount == null) return `Balance: ${bal}`;
  const target = Number(box.targetAmount);
  const remaining = target - balance;
  if (remaining <= 0) {
    return `${bal} / ${formatMoney(target)} · 🎉 target reached`;
  }
  const pct = target > 0 ? Math.round((balance / target) * 100) : 0;
  return `${bal} / ${formatMoney(target)} (${pct}%) · ${formatMoney(remaining)} to go`;
}

export interface RecordBoxEntryResult {
  balance: number;
  justReachedTarget: boolean;
}

// Adds one ledger entry, recomputes the balance, and (for inflows) stamps the
// once-only target-reached guard when the balance first crosses the target.
export async function recordBoxEntry(
  boxRepository: IBoxRepository,
  args: {
    box: Box;
    userId: string;
    amount: number;
    direction: BoxEntryDirection;
    source?: BoxEntrySource;
    note?: string | undefined;
    rawText?: string | undefined;
  },
): Promise<RecordBoxEntryResult> {
  await boxRepository.addEntry({
    boxId: args.box.id,
    userId: args.userId,
    amount: args.amount,
    direction: args.direction,
    source: args.source,
    note: args.note,
    rawText: args.rawText,
  });
  const balance = await boxRepository.balanceFor(args.box.id);
  let justReachedTarget = false;
  if (
    args.box.targetAmount != null &&
    balance >= Number(args.box.targetAmount)
  ) {
    // markTargetReached is the atomic guard — true only if this call stamped it.
    justReachedTarget = await boxRepository.markTargetReached(args.box.id);
  }
  return { balance, justReachedTarget };
}

// The confirmation reply after a box contribution/withdrawal.
export function boxEntryReply(
  box: Box,
  amount: number,
  direction: BoxEntryDirection,
  result: RecordBoxEntryResult,
): string {
  const icon = box.icon ? `${box.icon} ` : "";
  const arrow = direction === "IN" ? "→" : "←";
  const head = `✅ ${formatMoney(amount)} ${arrow} ${icon}${sanitizeMd(box.name)}`;
  const cheer = result.justReachedTarget
    ? `\n🎉 Goal reached! ${sanitizeMd(box.name)} hit ${formatMoney(Number(box.targetAmount))}.`
    : "";
  return `${head}\n📦 ${boxProgressLine(box, result.balance)}${cheer}`;
}
