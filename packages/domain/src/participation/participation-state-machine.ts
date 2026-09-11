/**
 * Participation state machine (CLAUDE.md #7):
 *
 *   CREATED -> RESERVED -> AWAITING_REQUIREMENT -> CONFIRMED -> ACTIVE
 *     -> LOCKED -> RESOLVED -> WON | NOT_WON -> COMPLETED
 *
 * Unlike Campaign/Room, CLAUDE.md's diagram documents no CANCELLED
 * branch for Participation, so none is invented here (CLAUDE.md #59:
 * the current CLAUDE.md is the source of truth, not an assumed
 * generalization from the other state machines).
 */
export type ParticipationStatus =
  | "CREATED"
  | "RESERVED"
  | "AWAITING_REQUIREMENT"
  | "CONFIRMED"
  | "ACTIVE"
  | "LOCKED"
  | "RESOLVED"
  | "WON"
  | "NOT_WON"
  | "COMPLETED";

const FORWARD_TRANSITIONS: Record<ParticipationStatus, readonly ParticipationStatus[]> = {
  CREATED: ["RESERVED"],
  RESERVED: ["AWAITING_REQUIREMENT"],
  AWAITING_REQUIREMENT: ["CONFIRMED"],
  CONFIRMED: ["ACTIVE"],
  ACTIVE: ["LOCKED"],
  LOCKED: ["RESOLVED"],
  RESOLVED: ["WON", "NOT_WON"],
  WON: ["COMPLETED"],
  NOT_WON: ["COMPLETED"],
  COMPLETED: [],
};

export function isTerminalParticipationStatus(status: ParticipationStatus): boolean {
  return status === "COMPLETED";
}

export function canTransitionParticipationStatus(
  from: ParticipationStatus,
  to: ParticipationStatus,
): boolean {
  return FORWARD_TRANSITIONS[from].includes(to);
}

export class InvalidParticipationTransitionError extends Error {
  constructor(
    public readonly from: ParticipationStatus,
    public readonly to: ParticipationStatus,
  ) {
    super(`Não é possível mover a participação de "${from}" para "${to}".`);
    this.name = "InvalidParticipationTransitionError";
  }
}

export function assertParticipationTransition(
  from: ParticipationStatus,
  to: ParticipationStatus,
): void {
  if (!canTransitionParticipationStatus(from, to)) {
    throw new InvalidParticipationTransitionError(from, to);
  }
}
