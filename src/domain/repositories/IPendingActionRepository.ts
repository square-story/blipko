import { PendingAction } from "@prisma/client";

export interface CreatePendingActionDTO {
  userId: string;
  kind: string;
  payload: unknown;
  summary: string;
  ttlMinutes: number;
}

export interface IPendingActionRepository {
  create(data: CreatePendingActionDTO): Promise<PendingAction>;
  // Scoped to the user on purpose. The callback id is unguessable, but "hard to
  // guess" is not an authorization check — the existing bkt: handler relies on
  // exactly that and never verifies ownership.
  findLiveForUser(id: string, userId: string): Promise<PendingAction | null>;
  // The newest live row of one kind. Unlike findLiveForUser there is no id to
  // go on: the carry-forward "type an amount" step is answered with a plain
  // number, so the only handle is "this user has an open request of this kind".
  findLiveByKindForUser(
    userId: string,
    kind: string,
  ): Promise<PendingAction | null>;
  // Marks consumed only if it was still unconsumed, so a double-tap on the
  // confirm button cannot apply the same write twice. Returns true for the
  // call that won.
  consume(id: string, userId: string): Promise<boolean>;
}
