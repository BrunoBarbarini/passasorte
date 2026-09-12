import {
  AdvanceRoomOperationsUseCase,
  DispatchOutboxEventsUseCase,
  ExpireBenefitsUseCase,
  ExpirePositionHoldsUseCase,
  type BenefitLedgerRepository,
  type GameRunRepository,
  type NotificationProvider,
  type NotificationRepository,
  type OutboxPort,
  type OutboxReaderPort,
  type ParticipationRepository,
  type PositionHoldRepository,
  type RoomRepository,
} from "@passasorte/application";
import type { Logger } from "@passasorte/observability";

export interface SchedulerDeps {
  roomRepository: RoomRepository;
  participationRepository: ParticipationRepository;
  positionHoldRepository: PositionHoldRepository;
  gameRunRepository: GameRunRepository;
  outbox: OutboxPort;
  outboxReader: OutboxReaderPort;
  notificationRepository: NotificationRepository;
  notificationProviders: readonly NotificationProvider[];
  benefitLedgerRepository: BenefitLedgerRepository;
  logger: Logger;
  /** CLAUDE.md #22 kill switch, default OFF — only gates the game-progression half of this tick. */
  gameAutoAdvanceEnabled: boolean;
  outboxBatchSize: number;
}

/**
 * TASK-033 Outbox Worker + TASK-034 Scheduler, one tick. Hold expiration
 * and outbox dispatch are fully decided mechanics (BR-010, ADR-010) and
 * always run; automatic room/game progression is gated behind
 * ENABLE_GAME_AUTO_ADVANCE (CLAUDE.md #22) because it is the part of
 * Phase 5 that actually moves rooms/participations/money-adjacent state
 * forward — an operator can still do all of the same work manually via
 * apps/api's OperationsController while this flag is off.
 */
export async function runSchedulerTick(deps: SchedulerDeps): Promise<void> {
  const expired = await new ExpirePositionHoldsUseCase(deps.positionHoldRepository).execute({});
  if (expired.length > 0) {
    deps.logger.info(
      { operation: "expire_holds", count: expired.length },
      "Expired stale position holds",
    );
  }

  const dispatched = await new DispatchOutboxEventsUseCase(
    deps.outboxReader,
    deps.notificationRepository,
    deps.notificationProviders,
  ).execute({ batchSize: deps.outboxBatchSize });
  if (dispatched > 0) {
    deps.logger.info(
      { operation: "dispatch_outbox", count: dispatched },
      "Dispatched outbox events",
    );
  }

  // FR-056 Benefit Expiration (background job `expire_benefits`,
  // CLAUDE.md #28). Always runs, like hold expiration/outbox dispatch
  // above — it is a mechanical time-based sweep, not itself a "use" of
  // the benefit, so it is not gated behind ENABLE_BENEFIT_REDEMPTION
  // (that flag only gates apps/api's redeem endpoint).
  const expiredBenefits = await new ExpireBenefitsUseCase(
    deps.benefitLedgerRepository,
    deps.outbox,
  ).execute({});
  if (expiredBenefits.expired.length > 0) {
    deps.logger.info(
      { operation: "expire_benefits", count: expiredBenefits.expired.length },
      "Expired promotional benefits",
    );
  }

  if (!deps.gameAutoAdvanceEnabled) {
    return;
  }

  const advanceUseCase = new AdvanceRoomOperationsUseCase(
    deps.roomRepository,
    deps.participationRepository,
    deps.gameRunRepository,
    deps.outbox,
  );

  const runningRooms = await deps.roomRepository.listByStatus("RUNNING");
  const finalLockRooms = await deps.roomRepository.listByStatus("FINAL_LOCK");

  for (const room of [...runningRooms, ...finalLockRooms]) {
    try {
      const result = await advanceUseCase.execute({ roomId: room.id });
      if (result.advanced) {
        deps.logger.info(
          { operation: "advance_room", roomId: room.id, newStatus: result.room.status },
          "Advanced room operations",
        );
      }
    } catch (error) {
      deps.logger.error(
        { operation: "advance_room", roomId: room.id, err: error },
        "Failed to advance room operations",
      );
    }
  }
}
