import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  NotFoundError,
  type CampaignListPage,
  type CampaignRepository,
  type ExperienceRepository,
  type MerchantRepository,
  type RoomRepository,
} from "@passasorte/application";
import type { Campaign, Experience, GameRoom, Merchant } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import {
  CAMPAIGN_REPOSITORY,
  EXPERIENCE_REPOSITORY,
  MERCHANT_REPOSITORY,
  ROOM_REPOSITORY,
} from "../../common/tokens.js";

/**
 * Read-only backoffice surface for the apps/web management UI
 * (merchants/experiences/campaigns/rooms CRUD screens). This is
 * deliberately a separate controller/prefix (`/backoffice/...`) rather
 * than adding GET handlers to MerchantsController/ExperiencesController/
 * CampaignsController/RoomsController at the SAME paths CatalogController
 * already owns (`campaigns/:id`, `campaigns/:id/rooms`, `rooms/:id`) -
 * two controllers registering the identical method+path would silently
 * shadow one another in Nest/Express routing depending on module import
 * order, which is not a risk worth taking. CatalogController's routes
 * stay public and filtered to SCHEDULED/PUBLISHED campaigns and
 * non-DRAFT rooms (FR-007); these routes are authenticated and show
 * every status, because an operator/merchant managing a DRAFT campaign
 * needs to see it before it's published.
 */
@Controller("backoffice")
@UseGuards(AuthGuard, RolesGuard)
export class BackofficeController {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepository: MerchantRepository,
    @Inject(EXPERIENCE_REPOSITORY) private readonly experienceRepository: ExperienceRepository,
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
  ) {}

  @Get("merchants")
  @Roles("OPERATOR", "ADMIN")
  listMerchants(): Promise<Merchant[]> {
    return this.merchantRepository.list();
  }

  @Get("merchants/:id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  async findMerchant(@Param("id") id: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findById(id);
    if (!merchant) throw new NotFoundError("Merchant", id);
    return merchant;
  }

  @Get("experiences")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  listExperiences(@Query("merchantId") merchantId: string): Promise<Experience[]> {
    return this.experienceRepository.listByMerchant(merchantId);
  }

  @Get("campaigns")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  listCampaigns(@Query("merchantId") merchantId?: string): Promise<CampaignListPage> {
    // No `statuses` filter (unlike ListPublicCampaignsUseCase) - the
    // backoffice needs to see DRAFT/IN_REVIEW/etc, not just what's
    // publicly on offer. 100 is a pragmatic cap, not a product decision;
    // real pagination for this screen is a follow-up if a merchant ever
    // has more campaigns than that.
    return this.campaignRepository.listPublished({ merchantId, limit: 100 });
  }

  @Get("campaigns/:id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  async findCampaign(@Param("id") id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) throw new NotFoundError("Campaign", id);
    return campaign;
  }

  @Get("campaigns/:campaignId/rooms")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  listRooms(@Param("campaignId") campaignId: string): Promise<readonly GameRoom[]> {
    return this.roomRepository.listByCampaignId(campaignId);
  }

  @Get("rooms/:id")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  async findRoom(@Param("id") id: string): Promise<GameRoom> {
    const room = await this.roomRepository.findById(id);
    if (!room) throw new NotFoundError("GameRoom", id);
    return room;
  }
}
