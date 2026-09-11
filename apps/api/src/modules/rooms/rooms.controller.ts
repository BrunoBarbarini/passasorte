import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CreateRoomSchema, HoldPositionsSchema } from "@passasorte/api-contract";
import {
  CreateRoomUseCase,
  HoldPositionsUseCase,
  type PositionHoldRepository,
  type RoomRepository,
} from "@passasorte/application";
import type { AuthenticatedUser, GameRoom, PositionHold } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import { POSITION_HOLD_REPOSITORY, ROOM_REPOSITORY } from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";
import { resolveEligibilityRules } from "../../infrastructure/eligibility/eligibility-rule-registry.js";

/**
 * TASK-024 Room Domain (operational side) + FR-022..FR-024 Position Hold.
 * Room creation is backoffice-only (no CLAUDE.md backlog task defines a
 * dedicated "Room Backoffice" surface — this mirrors CampaignsController's
 * shape rather than inventing new roles/flows). Holding positions is open
 * to any authenticated participant.
 */
@Controller()
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(POSITION_HOLD_REPOSITORY) private readonly holdRepository: PositionHoldRepository,
  ) {}

  @Post("campaigns/:campaignId/rooms")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  create(@Param("campaignId") campaignId: string, @Body() body: unknown): Promise<GameRoom> {
    const input = parseWithSchema(CreateRoomSchema, body);
    return new CreateRoomUseCase(this.roomRepository).execute({
      campaignId,
      capacity: input.capacity,
      gameConfig: input.gameConfig,
      holdTtlMs: input.holdTtlMs,
      participationPackages: input.participationPackages.map((pkg) => ({
        id: pkg.id,
        positionCount: pkg.positionCount,
        movementAllowance: pkg.movementAllowance,
        eligibilityRules: resolveEligibilityRules(pkg.eligibilityRuleIds ?? []),
        priceMinorUnits: pkg.priceMinorUnits,
      })),
    });
  }

  @Post("rooms/:roomId/holds")
  hold(
    @Param("roomId") roomId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<readonly PositionHold[]> {
    const input = parseWithSchema(HoldPositionsSchema, body);
    return new HoldPositionsUseCase(this.roomRepository, this.holdRepository).execute({
      roomId,
      positions: input.positions,
      holderRef: user.user.id,
    });
  }
}
