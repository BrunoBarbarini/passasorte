/**
 * Participation (FR-027..FR-030, BR-007/BR-008). A participation is the
 * canonical record of one entry into a room (FR-027), holding the
 * positions it was granted. A participant MAY own multiple positions
 * (BR-007) that need not be contiguous (BR-008).
 */
import type { Position } from "../game/board.js";
import type { ParticipationStatus } from "./participation-state-machine.js";

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
  readonly createdAt: Date;
}

/** Convenience accessor: the plain positions a participation currently holds. */
export function participationPositions(participation: Participation): readonly Position[] {
  return participation.positions.map((p) => p.position);
}
