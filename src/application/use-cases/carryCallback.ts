// callback_data grammar for the cycle-start carry-forward prompt ("car:").
//
//   car:<cycleKey>:s:<amount>           → to savings, pick a box next
//   car:<cycleKey>:s0:<amount>          → to savings, no box
//   car:<cycleKey>:b:<amount>:<boxId>   → to savings, into this box
//   car:<cycleKey>:o:<amount>           → to next cycle's opening balance
//   car:<cycleKey>:x                    → "different amount", typed next
//   car:<cycleKey>:n                    → skip this cycle
//
// cycleKey is a YYYY-MM-DD cycle start, so the button cannot settle a cycle the
// user has already moved on from. Worst case (a cuid box id) is ~50 bytes,
// inside Telegram's 64-byte callback_data cap.
//
// Dependency-free like act: and txn: next door, so the button builder and the
// processor can share it without an import cycle.

export type CarryChoice = "s" | "s0" | "b" | "o" | "x" | "n";

export interface CarryCallback {
  cycleKey: string;
  choice: CarryChoice;
  // Present for every choice that carries money. "x" and "n" have none.
  amount?: number;
  boxId?: string;
}

// Amounts ride in the callback_data rather than a staged row. It is the user's
// own money and they can type any figure anyway, so there is nothing to guard
// that the typed path does not already allow.
const amt = (amount: number): string => String(Math.round(amount));

export const carryCb = {
  savings: (cycleKey: string, amount: number) =>
    `car:${cycleKey}:s:${amt(amount)}`,
  savingsNoBox: (cycleKey: string, amount: number) =>
    `car:${cycleKey}:s0:${amt(amount)}`,
  box: (cycleKey: string, amount: number, boxId: string) =>
    `car:${cycleKey}:b:${amt(amount)}:${boxId}`,
  opening: (cycleKey: string, amount: number) =>
    `car:${cycleKey}:o:${amt(amount)}`,
  other: (cycleKey: string) => `car:${cycleKey}:x`,
  skip: (cycleKey: string) => `car:${cycleKey}:n`,
};

function parseAmount(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

export function parseCarryCallback(data: string): CarryCallback | null {
  const parts = data.split(":");
  if (parts[0] !== "car") return null;
  const cycleKey = parts[1];
  const choice = parts[2];
  if (!cycleKey) return null;

  switch (choice) {
    case "x":
    case "n":
      return parts.length === 3 ? { cycleKey, choice } : null;
    case "s":
    case "s0":
    case "o": {
      if (parts.length !== 4) return null;
      const amount = parseAmount(parts[3]);
      return amount === null ? null : { cycleKey, choice, amount };
    }
    case "b": {
      if (parts.length !== 5) return null;
      const amount = parseAmount(parts[3]);
      const boxId = parts[4];
      if (amount === null || !boxId) return null;
      return { cycleKey, choice, amount, boxId };
    }
    default:
      return null;
  }
}

export function isCarryCallback(data: string): boolean {
  return data.startsWith("car:");
}
