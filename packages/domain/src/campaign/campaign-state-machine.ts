/**
 * Campaign state machine (CLAUDE.md #7):
 *
 *   DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED -> ENDED
 *     \_______________________________________________________> CANCELLED
 *
 * BR-045: cancellation is terminal. ENDED is also terminal (a campaign
 * does not resume once it has ended). This module only knows *legality*
 * of a transition, not the business conditions that justify it (e.g.
 * what makes a campaign approvable) — those are TBD/out of Phase 1 scope
 * (CLAUDE.md #58) and must not be invented here.
 */
export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ENDED"
  | "CANCELLED";

const FORWARD_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["APPROVED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["ENDED", "CANCELLED"],
  ENDED: [],
  CANCELLED: [],
};

export function isTerminalCampaignStatus(status: CampaignStatus): boolean {
  return status === "ENDED" || status === "CANCELLED";
}

export function canTransitionCampaignStatus(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return FORWARD_TRANSITIONS[from].includes(to);
}

export class InvalidCampaignTransitionError extends Error {
  constructor(
    public readonly from: CampaignStatus,
    public readonly to: CampaignStatus,
  ) {
    super(`Não é possível mover a campanha de "${from}" para "${to}".`);
    this.name = "InvalidCampaignTransitionError";
  }
}

/** Throws InvalidCampaignTransitionError when the move is not legal. */
export function assertCampaignTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): void {
  if (!canTransitionCampaignStatus(from, to)) {
    throw new InvalidCampaignTransitionError(from, to);
  }
}
