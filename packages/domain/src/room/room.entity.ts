/**
 * GameRoom (FR-018..FR-021, BR-003/BR-004/BR-005). A campaign may open
 * multiple rooms (FR-018); each room has a FINITE, caller-supplied
 * capacity (BR-004/FR-019 — CLAUDE.md #58 forbids hard-coding a room
 * capacity default) and its own frozen game configuration snapshot
 * (BR-024, see @passasorte/domain's game/game-config.js), immutable for
 * as long as the room is active.
 */
import type { GameConfigSnapshot } from "../game/game-config.js";
import type { RoomStatus } from "./room-state-machine.js";

export type { RoomStatus } from "./room-state-machine.js";

export interface GameRoom {
  readonly id: string;
  readonly campaignId: string;
  readonly capacity: number;
  readonly gameConfig: GameConfigSnapshot;
  readonly status: RoomStatus;
  readonly createdAt: Date;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
}

export class InvalidRoomCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoomCapacityError";
  }
}

/** BR-004: every room has finite capacity — a positive integer, never assumed/hard-coded. */
export function assertValidRoomCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new InvalidRoomCapacityError("A capacidade da sala deve ser um inteiro positivo.");
  }
}
