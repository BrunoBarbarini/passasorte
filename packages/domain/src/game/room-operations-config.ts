/**
 * Room operations config (CLAUDE.md #42/#56/#58): the wall-clock pacing a
 * room's SCHEDULED operations (Phase 5, TASK-034) use to progress it —
 * NOT a business rule about game outcomes (movement effect, Sorte
 * algorithm and winner semantics stay exactly as pluggable/TBD as
 * movement.ts/sorte-progression.ts/winner-selection.ts already define
 * them). `finalLockGracePeriodMs` only answers "how long do we wait for
 * a straggler's final movement plan before applying the (also
 * TBD-but-already-pluggable) MissingFinalSubmissionPolicy from
 * final-lock.ts" — it is caller-supplied per room, exactly like
 * `holdTtlMs`, never a hard-coded/global default (CLAUDE.md #58).
 */
export interface RoomOperationsConfig {
  /** BR-029 support: grace period after a room enters FINAL_LOCK before missing submissions are resolved via the room's MissingFinalSubmissionPolicy. */
  readonly finalLockGracePeriodMs: number;
}

export class InvalidRoomOperationsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoomOperationsConfigError";
  }
}

export function assertValidRoomOperationsConfig(config: RoomOperationsConfig): void {
  if (!Number.isInteger(config.finalLockGracePeriodMs) || config.finalLockGracePeriodMs < 0) {
    throw new InvalidRoomOperationsConfigError(
      "O período de tolerância do bloqueio final deve ser um inteiro maior ou igual a zero.",
    );
  }
}
