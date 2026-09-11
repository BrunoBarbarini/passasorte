/**
 * Participation (FR-027..FR-030, BR-007/BR-008). A participation is the
 * canonical record of one entry into a room (FR-027), holding the
 * positions it was granted. A participant MAY own multiple positions
 * (BR-007) that need not be contiguous (BR-008).
 *
 * Movement allowance (BR-020) is tracked directly on the participation
 * (movementAllowanceTotal/movementAllowanceUsed) rather than in a
 * separate always-in-sync table — `toMovementAllocation` exposes it as
 * the pluggable `MovementAllocation` shape (movement-allocation.entity.js)
 * so `spendMovement()` keeps working unchanged.
 */
import type { Position } from "../game/board.js";
import type { ParticipationStatus } from "./participation-state-machine.js";
import type { MovementAllocation } from "./movement-allocation.entity.js";

export type { ParticipationStatus } from "./participation-state-machine.js";

export interface ParticipationPosition {
  readonly participationId: string;
  readonly position: Position;
}

export interface Participation {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly packageId: string;
  readonly positions: readonly ParticipationPosition[];
  readonly status: ParticipationStatus;
  /** BR-020: total movement budget granted by the package at creation time. */
  readonly movementAllowanceTotal: number;
  /** BR-020: how much of that budget has been spent so far. */
  readonly movementAllowanceUsed: number;
  readonly createdAt: Date;
}

/** Convenience accessor: the plain positions a participation currently holds. */
export function participationPositions(participation: Participation): readonly Position[] {
  return participation.positions.map((p) => p.position);
}

/** Projects a participation's movement fields into the pluggable MovementAllocation shape. */
export function toMovementAllocation(participation: Participation): MovementAllocation {
  return {
    participationId: participation.id,
    totalAllowance: participation.movementAllowanceTotal,
    usedCount: participation.movementAllowanceUsed,
  };
}
