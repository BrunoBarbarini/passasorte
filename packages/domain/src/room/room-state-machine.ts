/**
 * Game Room state machine (CLAUDE.md #7):
 *
 *   DRAFT -> OPEN -> ENTRY_LOCKED -> RUNNING -> FINAL_LOCK -> RESOLVING -> COMPLETED
 *     \_________________________________________________________________> CANCELLED
 *
 * Engine V2 rooms go ENTRY_LOCKED -> POSITION_SELECTION -> READY -> RUNNING (TASK-075,
 * DECISION-07..11). Engine V2 has no final lock (BR-067): a V2 room goes RUNNING -> RESOLVING directly
 * once the last round window closes.
 *
 * BR-045: cancellation is terminal. This module only knows *legality* of
 * a transition, not the business conditions that justify it (e.g. what
 * marks a room ready to open, or when it should auto-progress) — that
 * orchestration belongs to Phase 5 (Scheduled Game Operations) and must
 * not be invented here.
 */
export type RoomStatus =
  | "DRAFT"
  | "OPEN"
  | "ENTRY_LOCKED"
  | "POSITION_SELECTION"
  | "READY"
  | "RUNNING"
  | "FINAL_LOCK"
  | "RESOLVING"
  | "COMPLETED"
  | "CANCELLED";

const FORWARD_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["ENTRY_LOCKED", "CANCELLED"],
  // ENTRY_LOCKED -> RUNNING stays for the legacy (entry-time positions) path.
  ENTRY_LOCKED: ["POSITION_SELECTION", "RUNNING", "CANCELLED"],
  POSITION_SELECTION: ["READY", "CANCELLED"],
  READY: ["RUNNING", "CANCELLED"],
  RUNNING: ["FINAL_LOCK", "RESOLVING", "CANCELLED"],
  FINAL_LOCK: ["RESOLVING", "CANCELLED"],
  RESOLVING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isTerminalRoomStatus(status: RoomStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function canTransitionRoomStatus(from: RoomStatus, to: RoomStatus): boolean {
  return FORWARD_TRANSITIONS[from].includes(to);
}

export class InvalidRoomTransitionError extends Error {
  constructor(
    public readonly from: RoomStatus,
    public readonly to: RoomStatus,
  ) {
    super(`Não é possível mover a sala de "${from}" para "${to}".`);
    this.name = "InvalidRoomTransitionError";
  }
}

export function assertRoomTransition(from: RoomStatus, to: RoomStatus): void {
  if (!canTransitionRoomStatus(from, to)) {
    throw new InvalidRoomTransitionError(from, to);
  }
}
