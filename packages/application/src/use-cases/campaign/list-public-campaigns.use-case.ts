import type { CampaignListPage } from "../../ports/campaign-repository.port.js";
import type { CampaignRepository } from "../../ports/campaign-repository.port.js";

export interface ListPublicCampaignsQuery {
  cursor?: string;
  limit?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * FR-007 Campaign Catalog. Public/anonymous — CLAUDE.md #2.8 (discovery
 * before authentication) and #4.1. Only SCHEDULED/PUBLISHED campaigns are
 * "active/upcoming experiences" a visitor should see (#4.1); DRAFT/
 * IN_REVIEW/APPROVED are internal, and ENDED/CANCELLED are not "on offer"
 * anymore.
 */
export class ListPublicCampaignsUseCase {
  constructor(private readonly campaignRepository: CampaignRepository) {}

  async execute(query: ListPublicCampaignsQuery): Promise<CampaignListPage> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    return this.campaignRepository.listPublished({
      statuses: ["SCHEDULED", "PUBLISHED"],
      cursor: query.cursor,
      limit,
    });
  }
}
