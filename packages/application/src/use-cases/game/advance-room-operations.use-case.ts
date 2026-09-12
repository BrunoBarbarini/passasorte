import {
  assertParticipationTransition,
  assertRoomTransition,
  createGameEngineSimulationV1,
  isInFinalPhase,
  verifyRevealedSeed,
  SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1,
  type GameEngine,
  type GameRoom,
  type MovementCommand,
  type ParticipantEntryPositions,
  type ParticipationStatus,
} from "@passasorte/domain";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { GameRunRepository } from "../../ports/game-run-repository.port.js";
import type { OutboxPort } from "../../ports/outbox.port.js";
import { NotFoundError } from "../../errors.js";

export interface AdvanceRoomOperationsCommand {
  roomId: string;
  now?: Date;
  /**
   * Defaults to the Phase 2 simulation engine (createGameEngineSimulationV1)
   * — no other engine has been decided (CLAUDE.md #58), so a caller who
   * wants a different, later-decided engine must supply it explicitly
   * rather than this use case guessing at one.
   */
  engine?: GameEngine;
}

export interface AdvanceRoomOperationsResult {
  room: GameRoom;
  advanced: boolean;
}

const ACTIVE_GAME_STATUSES: readonly ParticipationStatus[] = ["ACTIVE", "LOCKED"];

/**
 * TASK-031 Game Result Engine / TASK-032 Winner Model / TASK-034
 * Scheduler (automatic side — see LockRoomEntriesUseCase/StartRoomUseCase
 * for the operator-triggered half of the room lifecycle). Invoked
 * periodically (see apps/worker) for every room currently RUNNING or
 * FINAL_LOCK; a no-op ("advanced: false") when neither this room's
 * trigger condition is met.
 *
 * RUNNING -> FINAL_LOCK is triggered purely by BR-026/BR-027: the highest
 * accepted movement command sequence for the room reaching
 * gameConfig.finalLock.finalPhaseStartSequence — a count, not a guessed
 * wall-clock threshold.
 *
 * FINAL_LOCK -> RESOLVING -> COMPLETED runs once every ACTIVE/LOCKED
 * participation has either locked a final plan or the room's own
 * operationsConfig.finalLockGracePeriodMs has elapsed since entering
 * FINAL_LOCK (an operational timeout, not a business rule — see
 * room-operations-config.js). Stragglers are resolved via the room's
 * SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1 policy (BR-029 stays TBD; this
 * is the same labeled Phase 2 placeholder, not a new invented rule), the
 * GameEngine then runs exactly once against the full accumulated
 * movement log (FR-044 replay), and the immutable GameResult/winners are
 * persisted (FR-043).
 */
export class AdvanceRoomOperationsUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly participationRepository: ParticipationRepository,
    private readonly gameRunRepository: GameRunRepository,
    private readonly outbox: OutboxPort,
  ) {}

  async execute(command: AdvanceRoomOperationsCommand): Promise<AdvanceRoomOperationsResult> {
    const now = command.now ?? new Date();
    const room = await this.roomRepository.findById(command.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", command.roomId);
    }

    if (room.status === "RUNNING") {
      return this.maybeEnterFinalLock(room, now);
    }
    if (room.status === "FINAL_LOCK") {
      return this.maybeResolve(room, now, command.engine ?? createGameEngineSimulationV1());
    }
    return { room, advanced: false };
  }

  private async maybeEnterFinalLock(
    room: GameRoom,
    now: Date,
  ): Promise<AdvanceRoomOperationsResult> {
    const commands = await this.participationRepository.listMovementCommandsForRoom(room.id);
    const maxSequence = commands.reduce((max, c) => Math.max(max, c.sequence), 0);
    if (!isInFinalPhase(maxSequence, room.gameConfig.finalLock)) {
      return { room, advanced: false };
    }

    const transitioned = await this.roomRepository.transition(room.id, "FINAL_LOCK", now);
    await this.outbox.publish({
      aggregateType: "GameRoom",
      aggregateId: room.id,
      eventType: "room.final_lock_entered",
      payload: { roomId: room.id },
    });
    return { room: transitioned, advanced: true };
  }

  private async maybeResolve(
    room: GameRoom,
    now: Date,
    engine: GameEngine,
  ): Promise<AdvanceRoomOperationsResult> {
    const participations = await this.participationRepository.listByRoomId(room.id);
    const activeParticipations = participations.filter((p) =>
      ACTIVE_GAME_STATUSES.includes(p.status),
    );

    const lockedPlans = await Promise.all(
      activeParticipations.map((p) => this.participationRepository.findFinalMovementPlan(p.id)),
    );
    const everyoneLocked = lockedPlans.every((plan) => plan !== null);

    const gracePeriodElapsed =
      room.finalLockedAt !== null &&
      now.getTime() - room.finalLockedAt.getTime() >= room.operationsConfig.finalLockGracePeriodMs;

    if (!everyoneLocked && !gracePeriodElapsed) {
      return { room, advanced: false };
    }

    // BR-029: resolve any straggler via the room's missing-submission policy.
    for (let i = 0; i < activeParticipations.length; i++) {
      if (lockedPlans[i]) continue;
      const participation = activeParticipations[i]!;
      const lastKnownCommands = (
        await this.participationRepository.listMovementCommandsForRoom(room.id)
      ).filter((c) => c.participationId === participation.id);
      const resolvedPlan = SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1.resolveMissingPlan({
        participationId: participation.id,
        lastKnownCommands,
        atSequence: room.gameConfig.finalLock.finalPhaseStartSequence,
      });
      assertParticipationTransition(participation.status, "LOCKED");
      await this.participationRepository.lockFinalMovementPlan(participation.id, resolvedPlan);
    }

    const seedRecord = await this.gameRunRepository.findSeedByRoomId(room.id);
    if (!seedRecord) {
      throw new NotFoundError("GameRun", room.id);
    }
    // BR-031: proves the seed was not swapped since StartRoomUseCase committed it.
    verifyRevealedSeed(seedRecord.seed, seedRecord.commitment);

    const initialPositions: ParticipantEntryPositions[] = activeParticipations.map((p) => ({
      participationId: p.id,
      positions: p.positions.map((pos) => pos.position),
    }));

    const allCommands = await this.participationRepository.listMovementCommandsForRoom(room.id);
    const roundsBySequence = new Map<number, MovementCommand[]>();
    for (const c of allCommands) {
      const round = roundsBySequence.get(c.sequence) ?? [];
      round.push(c);
      roundsBySequence.set(c.sequence, round);
    }
    const rounds = Array.from(roundsBySequence.keys())
      .sort((a, b) => a - b)
      .map((seq) => roundsBySequence.get(seq)!);

    const result = engine.run({
      config: room.gameConfig,
      initialPositions,
      revealedSeed: seedRecord.seed,
      rounds,
    });

    await this.gameRunRepository.saveResult(room.id, result);
    assertRoomTransition(room.status, "RESOLVING");
    await this.roomRepository.transition(room.id, "RESOLVING", now);

    const winnerParticipationIds = new Set(result.winners.map((w) => w.participationId));
    for (const participation of activeParticipations) {
      assertParticipationTransition(participation.status, "RESOLVED");
      await this.participationRepository.transition(participation.id, "RESOLVED");

      const finalStatus: ParticipationStatus = winnerParticipationIds.has(participation.id)
        ? "WON"
        : "NOT_WON";
      assertParticipationTransition("RESOLVED", finalStatus);
      await this.participationRepository.transition(participation.id, finalStatus);
      assertParticipationTransition(finalStatus, "COMPLETED");
      await this.participationRepository.transition(participation.id, "COMPLETED");

      await this.outbox.publish({
        aggregateType: "Participation",
        aggregateId: participation.id,
        eventType: finalStatus === "WON" ? "participation.won" : "participation.not_won",
        payload: {
          participationId: participation.id,
          roomId: room.id,
          userId: participation.userId,
        },
      });
    }

    assertRoomTransition("RESOLVING", "COMPLETED");
    const completed = await this.roomRepository.transition(room.id, "COMPLETED", now);
    await this.outbox.publish({
      aggregateType: "GameRoom",
      aggregateId: room.id,
      eventType: "room.completed",
      payload: { roomId: room.id, winnerCount: result.winners.length },
    });

    return { room: completed, advanced: true };
  }
}
