/**
 * Wire-shape types for apps/api's JSON responses (Phase 1/3/4 surface).
 * Deliberately independent from @passasorte/domain's entity types: over
 * HTTP every Date becomes an ISO string, and the mobile app should only
 * ever assume the shape the server actually sends, not the richer
 * server-side type. Field names mirror the domain entities 1:1.
 */

export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ENDED"
  | "CANCELLED";

export interface Campaign {
  id: string;
  merchantId: string;
  experienceId: string;
  title: string;
  status: CampaignStatus;
  timezone: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  publishedAt: string | null;
  endedAt: string | null;
}

export interface CampaignListPage {
  items: Campaign[];
  nextCursor: string | null;
}

export interface Merchant {
  id: string;
  legalName: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
}

export type RoomStatus =
  | "DRAFT"
  | "OPEN"
  | "ENTRY_LOCKED"
  | "RUNNING"
  | "FINAL_LOCK"
  | "RESOLVING"
  | "COMPLETED"
  | "CANCELLED";

export interface FinalLockConfig {
  finalPhaseStartSequence: number;
}

export interface GameConfigSnapshot {
  engineVersion: string;
  board: { size: number };
  initialSorteZone: { start: number; end: number };
  temperatureBands: { name: string; maxNormalizedDistance: number }[];
  movementAllowancePerParticipation: number;
  finalLock: FinalLockConfig;
}

export interface ParticipationPackage {
  id: string;
  positionCount: number;
  movementAllowance: number;
  eligibilityRuleIds?: string[];
  /** Present only once a price model exists (BR-034/BR-042 - TBD). */
  priceMinorUnits?: number;
}

export interface GameRoom {
  id: string;
  campaignId: string;
  capacity: number;
  gameConfig: GameConfigSnapshot;
  holdTtlMs: number;
  participationPackages: ParticipationPackage[];
  status: RoomStatus;
  createdAt: string;
  cancelledAt: string | null;
}

export type PositionStatus = "AVAILABLE" | "HELD" | "TAKEN";

export interface PositionState {
  position: number;
  status: PositionStatus;
}

export interface PositionHold {
  id: string;
  roomId: string;
  position: number;
  holderRef: string;
  status: "ACTIVE" | "RELEASED" | "COMMITTED" | "EXPIRED";
  heldAt: string;
  expiresAt: string;
}

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

export interface ParticipationPosition {
  participationId: string;
  position: number;
}

export interface Participation {
  id: string;
  roomId: string;
  userId: string;
  packageId: string;
  positions: ParticipationPosition[];
  status: ParticipationStatus;
  movementAllowanceTotal: number;
  movementAllowanceUsed: number;
  createdAt: string;
}

/** Server error envelope (CLAUDE.md #16) - every 4xx/5xx apps/api response follows this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details: Record<string, unknown>;
  };
}
