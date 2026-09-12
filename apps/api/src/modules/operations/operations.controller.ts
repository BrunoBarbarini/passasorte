import { Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  AdvanceRoomOperationsUseCase,
  DispatchOutboxEventsUseCase,
  ExpirePositionHoldsUseCase,
  ValidationError,
  type AnalyticsPort,
  type GameRunRepository,
  type NotificationProvider,
  type NotificationRepository,
  type OutboxPort,
  type OutboxReaderPort,
  type ParticipationRepository,
  type PositionHoldRepository,
  type RoomRepository,
} from "@passasorte/application";
import type { GameRoom, PositionHold, RoomStatus } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import {
  ANALYTICS_PORT,
  GAME_RUN_REPOSITORY,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_REPOSITORY,
  OUTBOX_PORT,
  OUTBOX_READER_PORT,
  PARTICIPATION_REPOSITORY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
} from "../../common/tokens.js";

const ROOM_STATUSES = new Set<RoomStatus>([
  "DRAFT",
  "OPEN",
  "ENTRY_LOCKED",
  "RUNNING",
  "FINAL_LOCK",
  "RESOLVING",
  "COMPLETED",
  "CANCELLED",
]);

/**
 * TASK-047 Game Operational Dashboard (backing API) + manual triggers for
 * TASK-033/TASK-034's automatic jobs. apps/worker runs these on a
 * schedule when ENABLE_GAME_AUTO_ADVANCE is on (CLAUDE.md #22 kill
 * switch, default OFF); these endpoints exist so an OPERATOR/ADMIN can
 * run the exact same use cases on demand — from the backoffice
 * dashboard, or while that flag is off — rather than the dashboard/API
 * needing a second, parallel implementation of the same logic.
 */
@Controller("operations")
@UseGuards(AuthGuard, RolesGuard)
@Roles("OPERATOR", "ADMIN")
export class OperationsController {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(PARTICIPATION_REPOSITORY)
    private readonly participationRepository: ParticipationRepository,
    @Inject(GAME_RUN_REPOSITORY) private readonly gameRunRepository: GameRunRepository,
    @Inject(POSITION_HOLD_REPOSITORY) private readonly holdRepository: PositionHoldRepository,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(OUTBOX_READER_PORT) private readonly outboxReader: OutboxReaderPort,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(NOTIFICATION_PROVIDERS)
    private readonly notificationProviders: readonly NotificationProvider[],
    @Inject(ANALYTICS_PORT) private readonly analytics: AnalyticsPort,
  ) {}

  @Get("rooms")
  async listRoomsByStatus(@Query("status") status: string): Promise<readonly GameRoom[]> {
    if (!ROOM_STATUSES.has(status as RoomStatus)) {
      throw new ValidationError("Status de sala inválido.", { field: "status" });
    }
    return this.roomRepository.listByStatus(status as RoomStatus);
  }

  @Get("outbox-backlog")
  async outboxBacklog(): Promise<{ pending: number }> {
    return { pending: await this.outboxReader.countUnprocessed() };
  }

  @Post("rooms/:roomId/advance")
  advanceRoom(@Param("roomId") roomId: string) {
    return new AdvanceRoomOperationsUseCase(
      this.roomRepository,
      this.participationRepository,
      this.gameRunRepository,
      this.outbox,
    ).execute({ roomId });
  }

  @Post("expire-holds")
  expireHolds(): Promise<readonly PositionHold[]> {
    return new ExpirePositionHoldsUseCase(this.holdRepository).execute({});
  }

  @Post("dispatch-outbox")
  dispatchOutbox(): Promise<number> {
    return new DispatchOutboxEventsUseCase(
      this.outboxReader,
      this.notifications,
      this.notificationProviders,
      this.analytics,
    ).execute({});
  }
}
