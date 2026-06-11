import { Bucket, NudgeKind } from "@prisma/client";

export interface INudgeRepository {
  // Records that this nudge was sent and returns true if it was newly recorded
  // (i.e. not sent before this period). Returns false if already sent — the
  // caller should then skip sending. Race-safe via the unique constraint.
  recordSentIfNew(
    userId: string,
    bucket: Bucket,
    kind: NudgeKind,
    periodKey: string,
  ): Promise<boolean>;
}
