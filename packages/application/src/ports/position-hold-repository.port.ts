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
 * Postgres adapter using a unique constraint or `SELECT ... FOR UPDATE`)
 * must guarantee that concurrent callers targeting the same room+position
 * never both succeed. `tryHold` returns null instead of throwing when the
 * position is already actively held/committed, so callers can decide how
 * to react (e.g. offer the next available position).
 */
export interface PositionHoldRepository {
  tryHold(input: TryHoldInput): Promise<PositionHold | null>;
  release(holdId: string): Promise<void>;
  findActiveHold(roomId: string, position: Position, now: Date): Promise<PositionHold | null>;
}
