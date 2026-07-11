import {
  Box,
  BoxEntry,
  BoxEntryDirection,
  BoxEntrySource,
} from "@prisma/client";
import { TxClient } from "./UnitOfWork";

export interface CreateBoxDTO {
  userId: string;
  name: string;
  icon?: string | undefined;
  targetAmount?: number | undefined;
  priority?: number | undefined;
  categoryId?: string | undefined;
}

export interface UpdateBoxDTO {
  name?: string | undefined;
  icon?: string | null | undefined;
  targetAmount?: number | null | undefined;
  priority?: number | undefined;
  categoryId?: string | null | undefined;
  isArchived?: boolean | undefined;
}

export interface CreateBoxEntryDTO {
  boxId: string;
  userId: string;
  amount: number;
  direction: BoxEntryDirection;
  source?: BoxEntrySource | undefined;
  note?: string | undefined;
  rawText?: string | undefined;
}

// A box plus its computed balance (Σ IN − Σ OUT over non-deleted entries).
export type BoxWithBalance = Box & { balance: number };

export interface IBoxRepository {
  create(data: CreateBoxDTO): Promise<Box>;
  findByIdForUser(id: string, userId: string): Promise<Box | null>;
  // Case-insensitive exact name match for a user (bot box resolution).
  findByNameForUser(userId: string, name: string): Promise<Box | null>;
  // The box a category is linked to, if any (drives diversion).
  findByCategoryId(userId: string, categoryId: string): Promise<Box | null>;
  // All non-archived boxes for a user with balances, ordered by priority.
  listWithBalances(userId: string): Promise<BoxWithBalance[]>;
  balanceFor(boxId: string): Promise<number>;
  update(id: string, data: UpdateBoxDTO): Promise<void>;
  delete(id: string): Promise<void>;

  addEntry(data: CreateBoxEntryDTO, tx?: TxClient): Promise<BoxEntry>;
  listEntries(boxId: string, userId: string): Promise<BoxEntry[]>;
  softDeleteEntry(id: string, userId: string): Promise<void>;

  // Goal boxes that have reached their target but not yet been alerted, for a
  // single user — the cron sweep computes balance and filters.
  goalBoxesPendingAlert(userId: string): Promise<BoxWithBalance[]>;
  // Idempotent once-only guard: stamp targetReachedAt if still null. Returns
  // true only for the call that actually stamped it (so the alert fires once).
  markTargetReached(id: string, tx?: TxClient): Promise<boolean>;
}
