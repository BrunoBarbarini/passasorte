import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { CursorPaginationQuerySchema } from "@passasorte/api-contract";
import {
  ListPublicCampaignsUseCase,
  NotFoundError,
  type CampaignListPage,
  type CampaignRepository,
  type MerchantRepository,
  type PositionHoldRepository,
  type RoomRepository,
} from "@passasorte/application";
import { isHoldActive, type Campaign, type GameRoom, type Merchant } from "@passasorte/domain";
import {
  CAMPAIGN_REPOSITORY,
  MERCHANT_REPOSITORY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
} from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/** Campaign statuses visible to an anonymous visitor (mirrors ListPublicCampaignsUseCase). */
const PUBLIC_CAMPAIGN_STATUSES = new Set(["SCHEDULED", "PUBLISHED"]);

export type PublicPositionStatus = "AVAILABLE" | "HELD" | "TAKEN";
export interface PublicPositionState {
  position: number;
  status: PublicPositionStatus;
}

/**
 * FR-007 Campaign Catalog - public/anonymous, no AuthGuard (CLAUDE.md
 * #2.8: discovery before authentication). Cursor-paginated per CLAUDE.md
 * #16. A campaign not currently SCHEDULED/PUBLISHED (DRAFT, IN_REVIEW,
 * APPROVED, ENDED, CANCELLED) is internal/no-longer-on-offer and is
 * reported as not found rather than leaking its existence/state to an
 * anonymous caller.
 *
 * Phase 4 addition: the same public/no-auth read surface extends to
 * rooms — FR-018..FR-023 (browsing rooms and their position board is
 * part of discovery, before a participant holds/joins anything, which
 * DOES require auth — see RoomsController/ParticipationsController). A
 * DRAFT room isn't open for entry yet, so it is hidden the same way a
 * non-public campaign is.
 */
@Controller()
export class CatalogController {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepository: MerchantRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(POSITION_HOLD_REPOSITORY) private readonly holdRepository: PositionHoldRepository,
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

  @Get("campaigns/:campaignId/rooms")
  async listRooms(@Param("campaignId") campaignId: string): Promise<readonly GameRoom[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign || !PUBLIC_CAMPAIGN_STATUSES.has(campaign.status)) {
      throw new NotFoundError("Campaign", campaignId);
    }
    const rooms = await this.roomRepository.listByCampaignId(campaignId);
    return rooms.filter((room) => room.status !== "DRAFT");
  }

  @Get("rooms/:id")
  async findRoom(@Param("id") id: string): Promise<GameRoom> {
    const room = await this.roomRepository.findById(id);
    if (!room || room.status === "DRAFT") {
      throw new NotFoundError("GameRoom", id);
    }
    return room;
  }

  @Get("rooms/:id/positions")
  async listPositions(@Param("id") id: string): Promise<PublicPositionState[]> {
    const room = await this.roomRepository.findById(id);
    if (!room || room.status === "DRAFT") {
      throw new NotFoundError("GameRoom", id);
    }
    const holds = await this.holdRepository.listForRoom(id);
    const now = new Date();
    const holdByPosition = new Map(holds.map((hold) => [hold.position, hold]));

    return Array.from({ length: room.capacity }, (_, position) => {
      const hold = holdByPosition.get(position);
      let status: PublicPositionStatus = "AVAILABLE";
      if (hold?.status === "COMMITTED") {
        status = "TAKEN";
      } else if (hold && isHoldActive(hold, now)) {
        status = "HELD";
      }
      return { position, status };
    });
  }
}
