import type { Position, PositionHold } from "@passasorte/domain";

export interface TryHoldInput {
  roomId: string;
  position: Position;
  holderRef: string;
  now: Date;
  expiresAt: Date;
}

/**
 * BR-010: acquiring a hold must be atomic — implementations (e.g. a
 * Postgres adapter using a unique constraint or `SELECT ... FOR UPDATE`
 * / a serializable transaction) must guarantee that concurrent callers
 * targeting the same room+position never both succeed. `tryHold` returns
 * null instead of throwing when the position is already actively held/
 * committed, so callers can decide how to react (e.g. offer the next
 * available position).
 */
export interface PositionHoldRepository {
  tryHold(input: TryHoldInput): Promise<PositionHold | null>;
  release(holdId: string): Promise<void>;
  findActiveHold(roomId: string, position: Position, now: Date): Promise<PositionHold | null>;
  /**
   * FR-026 Position Commitment: converts the active hold at this
   * room+position into a COMMITTED one (no longer subject to TTL
   * expiration), called once the owning participation is confirmed.
   * A no-op if there is no active hold there (defensive — the caller is
   * expected to have already verified ownership before confirming).
   */
  commitHold(roomId: string, position: Position): Promise<void>;
  /** One row per position that currently has any hold history in this room (any status). */
  listForRoom(roomId: string): Promise<readonly PositionHold[]>;
  /**
   * TASK-034 Scheduler: atomically transitions every ACTIVE hold whose
   * `expiresAt` is at/before `now` to EXPIRED and returns the rows that
   * were changed, so the position becomes available again without a
   * separate read-then-write race.
   */
  expireOverdue(now: Date): Promise<readonly PositionHold[]>;
}
