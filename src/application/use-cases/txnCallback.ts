// callback_data grammar for transaction actions (namespace "txn:").
// Kept dependency-free so both expenseFlow (button builders) and
// transactionActions/processors (parser) can share it without a cycle.
//
//   txn:askdel:<k>:<id>            [🗑 Delete] button → show delete confirm
//   txn:hintedit:<k>:<id>          [✏️ Edit] button → nudge to reply
//   txn:del:<k>:<id>:<y|n>         delete confirm result (also used by undo)
//   txn:delbatch:<batchId>:<y|n>   batch delete confirm result
//   txn:edit:<parseLogId>:<y|n>    edit confirm result (changes staged in ParseLog)
//   txn:restore:<k>:<id>           undo a single delete
//   txn:restorebatch:<batchId>     undo a batch delete
//
// `k` is a 1-char kind code ("e"=expense, "i"=income) so ids stay well under
// Telegram's 64-byte callback_data limit. cuids/uuids never contain ":".

export type TxnKind = "expense" | "income";

const KIND_CODE: Record<TxnKind, string> = { expense: "e", income: "i" };
const CODE_KIND: Record<string, TxnKind> = { e: "expense", i: "income" };

export type TxnCallback =
  | { action: "askdel"; kind: TxnKind; id: string }
  | { action: "askdelbatch"; batchId: string }
  | { action: "hintedit"; kind: TxnKind; id: string }
  | { action: "del"; kind: TxnKind; id: string; yes: boolean }
  | { action: "delbatch"; batchId: string; yes: boolean }
  | { action: "edit"; logId: string; yes: boolean }
  | { action: "restore"; kind: TxnKind; id: string }
  | { action: "restorebatch"; batchId: string };

export const txnCb = {
  askdel: (kind: TxnKind, id: string) => `txn:askdel:${KIND_CODE[kind]}:${id}`,
  askdelbatch: (batchId: string) => `txn:askdelbatch:${batchId}`,
  hintedit: (kind: TxnKind, id: string) =>
    `txn:hintedit:${KIND_CODE[kind]}:${id}`,
  del: (kind: TxnKind, id: string, yes: boolean) =>
    `txn:del:${KIND_CODE[kind]}:${id}:${yes ? "y" : "n"}`,
  delbatch: (batchId: string, yes: boolean) =>
    `txn:delbatch:${batchId}:${yes ? "y" : "n"}`,
  edit: (logId: string, yes: boolean) => `txn:edit:${logId}:${yes ? "y" : "n"}`,
  restore: (kind: TxnKind, id: string) =>
    `txn:restore:${KIND_CODE[kind]}:${id}`,
  restorebatch: (batchId: string) => `txn:restorebatch:${batchId}`,
};

export function isTxnCallback(data: string): boolean {
  return data.startsWith("txn:");
}

export function parseTxnCallback(data: string): TxnCallback | null {
  if (!data.startsWith("txn:")) return null;
  const p = data.split(":");
  const action = p[1];
  switch (action) {
    case "askdel":
    case "hintedit": {
      const kind = CODE_KIND[p[2] ?? ""];
      const id = p[3];
      if (!kind || !id) return null;
      return { action, kind, id };
    }
    case "askdelbatch": {
      const batchId = p[2];
      if (!batchId) return null;
      return { action, batchId };
    }
    case "del": {
      const kind = CODE_KIND[p[2] ?? ""];
      const id = p[3];
      if (!kind || !id) return null;
      return { action, kind, id, yes: p[4] === "y" };
    }
    case "delbatch": {
      const batchId = p[2];
      if (!batchId) return null;
      return { action, batchId, yes: p[3] === "y" };
    }
    case "edit": {
      const logId = p[2];
      if (!logId) return null;
      return { action, logId, yes: p[3] === "y" };
    }
    case "restore": {
      const kind = CODE_KIND[p[2] ?? ""];
      const id = p[3];
      if (!kind || !id) return null;
      return { action, kind, id };
    }
    case "restorebatch": {
      const batchId = p[2];
      if (!batchId) return null;
      return { action, batchId };
    }
    default:
      return null;
  }
}
