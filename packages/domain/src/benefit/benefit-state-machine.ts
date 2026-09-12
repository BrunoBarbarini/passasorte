/**
 * Benefit state machine (CLAUDE.md #7):
 *
 *   GRANTED -> AVAILABLE -> REDEEMED
 *                       \-> EXPIRED
 *                       \-> REVERSED
 *
 * GRANTED -> AVAILABLE is instantaneous and mechanical (there is no
 * external requirement to wait on, same reasoning as Participation's
 * CREATED -> RESERVED -> AWAITING_REQUIREMENT auto-advance in
 * CreateParticipationUseCase) — nothing in this codebase ever persists a
 * benefit in the GRANTED state; a grant is AVAILABLE the moment it
 * exists (see benefit.entity.ts's `deriveBenefitFromLedger`). BR-039:
 * balance/benefit state derive from the immutable ledger, never from a
 * separately mutable status column — this module only knows which
 * status transitions are legal, mirroring room/participation state
 * machines.
 */
export type BenefitStatus = "GRANTED" | "AVAILABLE" | "REDEEMED" | "EXPIRED" | "REVERSED";

const FORWARD_TRANSITIONS: Record<BenefitStatus, readonly BenefitStatus[]> = {
  GRANTED: ["AVAILABLE"],
  AVAILABLE: ["REDEEMED", "EXPIRED", "REVERSED"],
  REDEEMED: [],
  EXPIRED: [],
  REVERSED: [],
};

export function isTerminalBenefitStatus(status: BenefitStatus): boolean {
  return status === "REDEEMED" || status === "EXPIRED" || status === "REVERSED";
}

export function canTransitionBenefitStatus(from: BenefitStatus, to: BenefitStatus): boolean {
  return FORWARD_TRANSITIONS[from].includes(to);
}

export class InvalidBenefitTransitionError extends Error {
  constructor(
    public readonly from: BenefitStatus,
    public readonly to: BenefitStatus,
  ) {
    super(`Não é possível mover o benefício de "${from}" para "${to}".`);
    this.name = "InvalidBenefitTransitionError";
  }
}

export function assertBenefitTransition(from: BenefitStatus, to: BenefitStatus): void {
  if (!canTransitionBenefitStatus(from, to)) {
    throw new InvalidBenefitTransitionError(from, to);
  }
}
