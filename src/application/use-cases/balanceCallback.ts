// callback_data grammar for the balance check's gap buttons ("bal:").
//
//   bal:<pendingId>:y   → log the gap as an Untracked expense
//   bal:<pendingId>:n   → skip
//
// The amount lives on the staged PendingAction, not in the button: consume()
// is what makes the button single-use. A cuid id keeps this far inside
// Telegram's 64-byte callback_data cap.

export const balanceCb = {
  log: (id: string) => `bal:${id}:y`,
  skip: (id: string) => `bal:${id}:n`,
};

const BAL = /^bal:([A-Za-z0-9_-]{1,40}):([yn])$/;

export function parseBalanceCallback(
  data: string,
): { id: string; choice: "y" | "n" } | null {
  const m = BAL.exec(data ?? "");
  return m ? { id: m[1]!, choice: m[2] as "y" | "n" } : null;
}
