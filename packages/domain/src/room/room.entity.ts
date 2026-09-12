/**
 * GameRoom (FR-018..FR-021, BR-003/BR-004/BR-005). A campaign may open
 * multiple rooms (FR-018); each room has a FINITE, caller-supplied
 * capacity (BR-004/FR-019 — CLAUDE.md #58 forbids hard-coding a room
 * capacity default) and its own frozen game configuration snapshot
 * (BR-024, see @passasorte/domain's game/game-config.js), immutable for
 * as long as the room is active.
 *
 * `holdTtlMs` (CLAUDE.md #56 Technical-HIGH: hold TTL is TBD) and
 * `participationPackages` (FR-029, CLAUDE.md #58: eligibility/packages
 * are TBD) are stored per-room rather than as a global default, exactly
 * like gameConfig — CLAUDE.md #42/#58 explicitly forbid promoting a
 * business constant like this into global process/env configuration; it
 * must be configurable per-room data, decided by whoever creates the
 * room, never assumed by this codebase.
 */
import type { GameConfigSnapshot } from "../game/game-config.js";
import type { RoomStatus } from "./room-state-machine.js";
import type { ParticipationPackage } from "../participation/participation-package.js";
import type { RoomOperationsConfig } from "../game/room-operations-config.js";

export type { RoomStatus } from "./room-state-machine.js";

export interface GameRoom {
  readonly id: string;
  readonly campaignId: string;
  readonly capacity: number;
  readonly gameConfig: GameConfigSnapshot;
  /** CLAUDE.md #56: hold TTL is TBD — always caller-supplied per room, never hard-coded. */
  readonly holdTtlMs: number;
  /** FR-029: the packages a participant may enter this room with. */
  readonly participationPackages: readonly ParticipationPackage[];
  /** TASK-034 Scheduler pacing for this room (CLAUDE.md #56/#58: per-room, never a global default — see room-operations-config.js). */
  readonly operationsConfig: RoomOperationsConfig;
  readonly status: RoomStatus;
  readonly createdAt: Date;
  /** TASK-034 Scheduler: when this room entered FINAL_LOCK — used only to pace the grace-period timeout (operationsConfig.finalLockGracePeriodMs), never a business rule about outcomes. */
  readonly finalLockedAt: Date | null;
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
