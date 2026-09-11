import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { CursorPaginationQuerySchema } from "@passasorte/api-contract";
import {
  ListPublicCampaignsUseCase,
  NotFoundError,
  type CampaignListPage,
  type CampaignRepository,
  type MerchantRepository,
} from "@passasorte/application";
import type { Campaign, Merchant } from "@passasorte/domain";
import { CAMPAIGN_REPOSITORY, MERCHANT_REPOSITORY } from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/** Campaign statuses visible to an anonymous visitor (mirrors ListPublicCampaignsUseCase). */
const PUBLIC_CAMPAIGN_STATUSES = new Set(["SCHEDULED", "PUBLISHED"]);

/**
 * FR-007 Campaign Catalog - public/anonymous, no AuthGuard (CLAUDE.md
 * #2.8: discovery before authentication). Cursor-paginated per CLAUDE.md
 * #16. A campaign not currently SCHEDULED/PUBLISHED (DRAFT, IN_REVIEW,
 * APPROVED, ENDED, CANCELLED) is internal/no-longer-on-offer and is
 * reported as not found rather than leaking its existence/state to an
 * anonymous caller.
 */
@Controller()
export class CatalogController {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepository: MerchantRepository,
  ) {}

  @Get("campaigns")
  listCampaigns(@Query() query: unknown): Promise<CampaignListPage> {
    const input = parseWithSchema(CursorPaginationQuerySchema, query);
    return new ListPublicCampaignsUseCase(this.campaignRepository).execute(input);
  }

  @Get("campaigns/:id")
  async findCampaign(@Param("id") id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign || !PUBLIC_CAMPAIGN_STATUSES.has(campaign.status)) {
      throw new NotFoundError("Campaign", id);
    }
    return campaign;
  }

  @Get("merchants/:id")
  async findMerchant(@Param("id") id: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findById(id);
    if (!merchant) {
      throw new NotFoundError("Merchant", id);
    }
    return merchant;
  }
}
