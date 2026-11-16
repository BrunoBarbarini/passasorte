import { Body, Controller, Get, Inject, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  CreateRoomSchema,
  HoldPositionsSchema,
  PositionSelectionConfigSchema,
  StartPositionSelectionSchema,
  StartRoomV2Schema,
} from "@passasorte/api-contract";
import {
  CreateRoomUseCase,
  OpenRoomUseCase,
  LockRoomEntriesUseCase,
  StartRoomUseCase,
  StartRoomV2UseCase,
  StartPositionSelectionUseCase,
  SetPositionSelectionConfigUseCase,
  buildSelectionState,
  currentPickWindow,
  NotFoundError,
  type PositionSelectionPort,
  type EngineV2StartPort,
  HoldPositionsUseCase,
  type AuditLogPort,
  type CampaignRepository,
  type RoomSelectionConfigRepository,
  type GameRunRepository,
  type OutboxPort,
  type ParticipationRepository,
  type PositionHoldRepository,
  type RoomRepository,
} from "@passasorte/application";
import {
  gameV2,
  type AuthenticatedUser,
  type GameRoom,
  type PilotPolicy,
  type PositionHold,
} from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import {
  AUDIT_LOG_PORT,
  CAMPAIGN_REPOSITORY,
  ENGINE_V2_START_PORT,
  ROOM_SELECTION_CONFIG_REPOSITORY,
  POSITION_SELECTION_PORT,
  GAME_RUN_REPOSITORY,
  OUTBOX_PORT,
  PARTICIPATION_REPOSITORY,
  PILOT_POLICY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
} from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";
import { resolveEligibilityRules } from "../../infrastructure/eligibility/eligibility-rule-registry.js";

export interface PositionSelectionView {
  readonly serverTime: string;
  readonly status: string;
  readonly boardSize: number | null;
  /** Positions already owned: needed to choose among the free ones (DECISION-07). */
  readonly takenPositions: readonly number[];
  readonly pickWindowMs: number | null;
  /** DECISION-23/26: the window each participant gets; known as soon as the operator configures it. */
  readonly selectionWindowSeconds: number | null;
  /** DECISION-25/26: UX marks (remaining seconds) frozen when the selection starts. */
  readonly warningThresholdSeconds: readonly number[];
  readonly currentTurn: {
    readonly participationId: string;
    readonly positionCount: number;
    readonly opensAt: string;
    readonly deadline: string;
  } | null;
  readonly picked?: number;
  readonly total?: number;
}

/**
 * TASK-024 Room Domain (operational side) + FR-022..FR-024 Position Hold
 * + Phase 5's room-lifecycle operator actions (OPEN -> ENTRY_LOCKED ->
 * RUNNING). Room creation/lifecycle is backoffice-only (no CLAUDE.md
 * backlog task defines a dedicated "Room Backoffice" surface — this
 * mirrors CampaignsController's shape rather than inventing new roles/
 * flows). Holding positions is open to any authenticated participant.
 */
@Controller()
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(POSITION_HOLD_REPOSITORY) private readonly holdRepository: PositionHoldRepository,
    @Inject(PARTICIPATION_REPOSITORY)
    private readonly participationRepository: ParticipationRepository,
    @Inject(GAME_RUN_REPOSITORY) private readonly gameRunRepository: GameRunRepository,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(PILOT_POLICY) private readonly pilotPolicy: PilotPolicy,
    @Inject(ENGINE_V2_START_PORT) private readonly engineV2Start: EngineV2StartPort,
    @Inject(POSITION_SELECTION_PORT) private readonly selection: PositionSelectionPort,
    @Inject(ROOM_SELECTION_CONFIG_REPOSITORY)
    private readonly selectionConfigStore: RoomSelectionConfigRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  @Post("campaigns/:campaignId/rooms")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  create(@Param("campaignId") campaignId: string, @Body() body: unknown): Promise<GameRoom> {
    const input = parseWithSchema(CreateRoomSchema, body);
    return new CreateRoomUseCase(
      this.roomRepository,
      this.campaignRepository,
      this.pilotPolicy,
    ).execute({
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
      operationsConfig: input.operationsConfig,
      ...(input.positionSelectionConfig
        ? { positionSelectionConfig: input.positionSelectionConfig }
        : {}),
    });
  }

  /** DECISION-23/36: the operator sets how long each participant has to choose; no default exists. */
  @Put("rooms/:roomId/position-selection-config")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  setPositionSelectionConfig(
    @Param("roomId") roomId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameRoom> {
    const config = parseWithSchema(PositionSelectionConfigSchema, body);
    return new SetPositionSelectionConfigUseCase(
      this.roomRepository,
      this.selectionConfigStore,
      this.auditLog,
    ).execute({ roomId, config, actorUserId: user.user.id });
  }

  @Post("rooms/:roomId/open")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  open(@Param("roomId") roomId: string): Promise<GameRoom> {
    return new OpenRoomUseCase(this.roomRepository).execute({ roomId });
  }

  @Post("rooms/:roomId/lock-entries")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  lockEntries(@Param("roomId") roomId: string): Promise<GameRoom> {
    return new LockRoomEntriesUseCase(this.roomRepository).execute({ roomId });
  }

  @Post("rooms/:roomId/start")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  start(@Param("roomId") roomId: string): Promise<GameRoom> {
    return new StartRoomUseCase(
      this.roomRepository,
      this.participationRepository,
      this.gameRunRepository,
    ).execute({ roomId });
  }

  /** TASK-075: ENTRY_LOCKED -> POSITION_SELECTION. The window comes from the room config (DECISION-23). */
  @Post("rooms/:roomId/start-selection")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  startSelection(@Param("roomId") roomId: string, @Body() body: unknown): Promise<GameRoom> {
    parseWithSchema(StartPositionSelectionSchema, body ?? {});
    return new StartPositionSelectionUseCase(this.roomRepository, this.selection).execute({
      roomId,
    });
  }

  /** TASK-075: public-to-participants view of the selection: whose turn, until when, who picked. */
  @Get("rooms/:roomId/position-selection")
  async positionSelection(@Param("roomId") roomId: string): Promise<PositionSelectionView> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) throw new NotFoundError("GameRoom", roomId);
    if (!room.positionSelection) {
      return {
        serverTime: new Date().toISOString(),
        status: room.status,
        boardSize: null,
        takenPositions: [],
        pickWindowMs: null,
        selectionWindowSeconds: room.positionSelectionConfig?.selectionWindowSeconds ?? null,
        warningThresholdSeconds: room.positionSelectionConfig?.warningThresholdSeconds ?? [],
        currentTurn: null,
      };
    }
    const snapshot = await this.selection.loadSnapshot(roomId);
    const state = buildSelectionState(room, snapshot);
    const picker = room.status === "POSITION_SELECTION" ? gameV2.currentPicker(state) : null;
    const window = currentPickWindow(room, snapshot);
    return {
      serverTime: new Date().toISOString(),
      status: room.status,
      boardSize: room.positionSelection.boardSize,
      takenPositions: snapshot.assignments.flatMap((a) => a.positions).sort((x, y) => x - y),
      pickWindowMs: room.positionSelection.pickWindowMs,
      selectionWindowSeconds: room.positionSelection.pickWindowMs / 1000,
      warningThresholdSeconds: room.positionSelection.warningThresholdSeconds ?? [],
      currentTurn: picker
        ? {
            participationId: picker.participantId,
            positionCount: picker.positionCredits,
            opensAt: window.openedAt.toISOString(),
            deadline: window.closesAt.toISOString(),
          }
        : null,
      picked: snapshot.assignments.length,
      total: snapshot.entries.length,
    };
  }

  /** TASK-106: Engine V2 start. Freezes the config (cap required) and creates the round windows. */
  @Post("rooms/:roomId/start-v2")
  @UseGuards(RolesGuard)
  @Roles("OPERATOR", "ADMIN")
  startV2(@Param("roomId") roomId: string, @Body() body: unknown): Promise<GameRoom> {
    const input = parseWithSchema(StartRoomV2Schema, body);
    return new StartRoomV2UseCase(this.roomRepository, this.engineV2Start).execute({
      roomId,
      config: input.config,
      schedule: input.schedule,
    });
  }

  @Post("rooms/:roomId/holds")
  hold(
    @Param("roomId") roomId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<readonly PositionHold[]> {
    const input = parseWithSchema(HoldPositionsSchema, body);
    return new HoldPositionsUseCase(this.roomRepository, this.holdRepository, this.outbox).execute({
      roomId,
      positions: input.positions,
      holderRef: user.user.id,
    });
  }
}
