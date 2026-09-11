import type { ExperienceSnapshot } from "../catalog/experience.entity.js";
import type { CampaignStatus } from "./campaign-state-machine.js";

export type { CampaignStatus } from "./campaign-state-machine.js";

/**
 * FR-013..FR-017. BR-047: timestamps are UTC; `timezone` is the
 * campaign's own IANA timezone for display/scheduling. `experienceSnapshot`
 * is null until publication (BR-002).
 */
export interface Campaign {
  id: string;
  merchantId: string;
  experienceId: string;
  title: string;
  status: CampaignStatus;
  timezone: string;
  experienceSnapshot: ExperienceSnapshot | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  publishedAt: Date | null;
  endedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Only a DRAFT campaign's editable fields may still change (FR-014). */
export function isCampaignEditable(campaign: Campaign): boolean {
  return campaign.status === "DRAFT";
}
