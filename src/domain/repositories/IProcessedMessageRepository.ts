export interface IProcessedMessageRepository {
  // Atomically records the id. Returns true if this call claimed it (first
  // delivery), false if it was already processed — lets the caller dedup
  // without a separate exists() check that could race under concurrent retries.
  claim(messageId: string): Promise<boolean>;
}
