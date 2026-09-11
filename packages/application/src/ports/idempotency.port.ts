/**
 * Generic dedupe port for idempotent commands (FR-038 Idempotent
 * Movement Submission, BR-037 financial commands are idempotent — this
 * same shape covers both). `record` returns false when the key was
 * already seen (a duplicate submission), true the first time.
 */
export interface IdempotencyPort {
  record(key: string): Promise<boolean>;
}
