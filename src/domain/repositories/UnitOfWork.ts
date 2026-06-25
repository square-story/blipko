import { Prisma } from "@prisma/client";

// Transaction-scoped client passed to repository write methods so several
// writes can commit atomically. Matches the client Prisma hands to the
// interactive-transaction callback.
export type TxClient = Prisma.TransactionClient;

// Runs a function inside a single DB transaction. Injected into use cases that
// must commit multiple writes atomically; the composition root supplies the
// concrete `prisma.$transaction` implementation.
export type RunInTransaction = <T>(
  fn: (tx: TxClient) => Promise<T>,
) => Promise<T>;
