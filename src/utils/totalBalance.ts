import { Decimal } from "@prisma/client/runtime/library";

export function totalBalance(
  contactTransactions: { intent: string; amount: Decimal }[],
): number {
  let balance = 0;
  for (const t of contactTransactions) {
    if (t.intent === "CREDIT") {
      // I gave money
      balance += Number(t.amount);
    } else if (t.intent === "DEBIT") {
      // I received money
      balance -= Number(t.amount);
    }
  }
  return balance;
}
