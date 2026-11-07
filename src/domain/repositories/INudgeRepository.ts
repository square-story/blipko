import { Bucket, NudgeKind } from "@prisma/client";

export interface INudgeRepository {
  // Records that this nudge was sent and returns true if it was newly recorded
  // (i.e. not sent before this period). Returns false if already sent — the
  // caller should then skip sending. Race-safe via the unique constraint.
  // `meta` is stored with the row for a later message to read back.
  recordSentIfNew(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
    meta?: Record<string, unknown>,
  ): Promise<boolean>;

  // The meta stored with a sent nudge, or null when it was never sent or
  // stored none. Untrusted shape — callers validate.
  findMeta(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
  ): Promise<unknown>;
}
