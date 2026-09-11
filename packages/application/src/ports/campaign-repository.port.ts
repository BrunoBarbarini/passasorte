import type { Campaign, CampaignStatus } from "@passasorte/domain";
import type { ExperienceSnapshot } from "@passasorte/domain";

export interface CreateCampaignInput {
  merchantId: string;
  experienceId: string;
  title: string;
  timezone?: string;
  scheduledStartAt?: Date | null;
  scheduledEndAt?: Date | null;
}

export interface UpdateCampaignDraftInput {
  title?: string;
  timezone?: string;
  scheduledStartAt?: Date | null;
  scheduledEndAt?: Date | null;
}

export interface TransitionCampaignInput {
  status: CampaignStatus;
  experienceSnapshot?: ExperienceSnapshot | null;
  cancellationReason?: string | null;
  at: Date;
}

export interface CampaignListFilter {
  statuses?: CampaignStatus[];
  merchantId?: string;
  cursor?: string;
  limit: number;
}

export interface CampaignListPage {
  items: Campaign[];
  nextCursor: string | null;
}

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  create(input: CreateCampaignInput): Promise<Campaign>;
  updateDraft(id: string, input: UpdateCampaignDraftInput): Promise<Campaign>;
  transition(id: string, input: TransitionCampaignInput): Promise<Campaign>;
  listPublished(filter: CampaignListFilter): Promise<CampaignListPage>;
}
