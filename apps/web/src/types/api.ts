/**
 * Wire-shape types for the dashboard, independent of @passasorte/domain
 * (same reasoning as apps/mobile's src/types/api.ts: dates arrive as ISO
 * strings over HTTP, not Date instances, and this app should not import
 * runtime domain code across the HTTP boundary).
 */
export type RoomStatus =
  | "DRAFT"
  | "OPEN"
  | "ENTRY_LOCKED"
  | "RUNNING"
  | "FINAL_LOCK"
  | "RESOLVING"
  | "COMPLETED"
  | "CANCELLED";

export interface GameRoomView {
  id: string;
  campaignId: string;
  capacity: number;
  status: RoomStatus;
  createdAt: string;
  finalLockedAt: string | null;
}

export interface OutboxBacklog {
  pending: number;
}

// --- Backoffice (merchants/experiences/campaigns/rooms CRUD) -----------
// Wire shapes for the /backoffice/* read endpoints + the existing
// merchants/experiences/campaigns/rooms write endpoints. Same reasoning
// as GameRoomView above: independent from @passasorte/domain, dates as
// ISO strings.

export type MerchantStatus = "ACTIVE" | "INACTIVE";

export interface MerchantView {
  id: string;
  legalName: string;
  displayName: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantLocationView {
  id: string;
  merchantId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export type ExperienceStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ExperienceView {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  status: ExperienceStatus;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ENDED"
  | "CANCELLED";

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ENDED",
  "CANCELLED",
];

export interface CampaignView {
  id: string;
  merchantId: string;
  experienceId: string;
  title: string;
  status: CampaignStatus;
  timezone: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  publishedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListPageView {
  items: CampaignView[];
  nextCursor: string | null;
}

export interface GameRoomFullView extends GameRoomView {
  gameConfig: unknown;
  holdTtlMs: number;
  participationPackages: unknown;
  operationsConfig: unknown;
  cancelledAt: string | null;
  cancellationReason: string | null;
}
