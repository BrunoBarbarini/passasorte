/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type {
  FinalMovementPlan,
  GameConfigSnapshot,
  GameRoom,
  MovementAllocation,
  MovementCommand,
  Notification,
  NotificationChannel,
  NotificationPreference,
  Participation,
  ParticipationPackage,
  ParticipationStatus,
  Position,
  PositionHold,
} from "@passasorte/domain";
import { HoldPositionsUseCase } from "../use-cases/room/hold-positions.use-case.js";
import { CreateParticipationUseCase } from "../use-cases/participation/create-participation.use-case.js";
import { ConfirmParticipationUseCase } from "../use-cases/participation/confirm-participation.use-case.js";
import { SubmitMovementCommandUseCase } from "../use-cases/participation/submit-movement-command.use-case.js";
import { SubmitFinalMovementCommandUseCase } from "../use-cases/participation/submit-final-movement-command.use-case.js";
import { DispatchOutboxEventsUseCase } from "../use-cases/notification/dispatch-outbox-events.use-case.js";
import type { CreateRoomInput, RoomRepository } from "../ports/room-repository.port.js";
import type {
  PositionHoldRepository,
  TryHoldInput,
} from "../ports/position-hold-repository.port.js";
import type {
  CreateParticipationInput,
  ParticipationRepository,
} from "../ports/participation-repository.port.js";
import type { IdempotencyPort } from "../ports/idempotency.port.js";
import type {
  OutboxEventRecord,
  OutboxReaderPort,
  PublishOutboxEventInput,
} from "../ports/outbox.port.js";
import type {
  CreateNotificationInput,
  NotificationRepository,
} from "../ports/notification-repository.port.js";
import type { TrackAnalyticsEventInput } from "../ports/analytics.port.js";
import { ConflictError } from "../errors.js";

/** Records every published event instead of doing anything with them - shared by every use-case test below. */
class RecordingOutboxPort {
  readonly published: PublishOutboxEventInput[] = [];
  async publish(input: PublishOutboxEventInput): Promise<void> {
    this.published.push(input);
  }
}

const GAME_CONFIG: GameConfigSnapshot = {
  engineVersion: "SIMULATION_V1",
  board: { size: 10 },
  initialSorteZone: { start: 4, end: 5 },
  temperatureBands: [{ name: "UNICA", maxNormalizedDistance: 1 }],
  movementAllowancePerParticipation: 3,
  finalLock: { finalPhaseStartSequence: 5 },
};

function buildRoom(overrides: Partial<GameRoom> = {}): GameRoom {
  return {
    id: "room-1",
    campaignId: "campaign-1",
    capacity: 10,
    gameConfig: GAME_CONFIG,
    holdTtlMs: 60_000,
    participationPackages: [
      { id: "pkg-1", positionCount: 1, movementAllowance: 3, eligibilityRules: [] },
    ],
    operationsConfig: { finalLockGracePeriodMs: 30_000 },
    status: "OPEN",
    createdAt: new Date(),
    finalLockedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

class InMemoryRoomRepository implements RoomRepository {
  constructor(private room: GameRoom) {}
  async findById(id: string): Promise<GameRoom | null> {
    return id === this.room.id ? this.room : null;
  }
  async create(_input: CreateRoomInput): Promise<GameRoom> {
    throw new Error("not needed in this test");
  }
  async transition(_id: string, status: GameRoom["status"]): Promise<GameRoom> {
    this.room = { ...this.room, status };
    return this.room;
  }
  async listByCampaignId(campaignId: string): Promise<readonly GameRoom[]> {
    return campaignId === this.room.campaignId ? [this.room] : [];
  }
  async listByStatus(status: GameRoom["status"]): Promise<readonly GameRoom[]> {
    return status === this.room.status ? [this.room] : [];
  }
}

class InMemoryPositionHoldRepository implements PositionHoldRepository {
  private nextId = 1;
  private readonly holdsByKey = new Map<string, PositionHold>();
  private key(roomId: string, position: Position): string {
    return `${roomId}:${position}`;
  }
  async tryHold(input: TryHoldInput): Promise<PositionHold | null> {
    const key = this.key(input.roomId, input.position);
    const existing = this.holdsByKey.get(key);
    if (
      existing &&
      existing.status === "ACTIVE" &&
      existing.expiresAt.getTime() > input.now.getTime()
    ) {
      return null;
    }
    const hold: PositionHold = {
      id: `hold-${this.nextId++}`,
      roomId: input.roomId,
      position: input.position,
      holderRef: input.holderRef,
      status: "ACTIVE",
      heldAt: input.now,
      expiresAt: input.expiresAt,
    };
    this.holdsByKey.set(key, hold);
    return hold;
  }
  async release(holdId: string): Promise<void> {
    for (const [key, hold] of this.holdsByKey.entries()) {
      if (hold.id === holdId) this.holdsByKey.set(key, { ...hold, status: "RELEASED" });
    }
  }
  async findActiveHold(
    roomId: string,
    position: Position,
    now: Date,
  ): Promise<PositionHold | null> {
    const hold = this.holdsByKey.get(this.key(roomId, position));
    if (!hold || hold.status !== "ACTIVE" || hold.expiresAt.getTime() <= now.getTime()) return null;
    return hold;
  }
  async commitHold(roomId: string, position: Position): Promise<void> {
    const key = this.key(roomId, position);
    const hold = this.holdsByKey.get(key);
    if (hold && hold.status === "ACTIVE")
      this.holdsByKey.set(key, { ...hold, status: "COMMITTED" });
  }
  async listForRoom(roomId: string): Promise<readonly PositionHold[]> {
    return [...this.holdsByKey.values()].filter((h) => h.roomId === roomId);
  }
  async expireOverdue(): Promise<readonly PositionHold[]> {
    return [];
  }
}

class InMemoryParticipationRepository implements ParticipationRepository {
  private nextId = 1;
  private readonly byId = new Map<string, Participation>();
  private readonly finalPlansById = new Map<string, FinalMovementPlan>();

  async findById(id: string): Promise<Participation | null> {
    return this.byId.get(id) ?? null;
  }
  async create(input: CreateParticipationInput): Promise<Participation> {
    const id = `participation-${this.nextId++}`;
    const participation: Participation = {
      id,
      roomId: input.roomId,
      userId: input.userId,
      packageId: input.packageId,
      positions: input.positions.map((position) => ({ participationId: id, position })),
      status: "CREATED",
      movementAllowanceTotal: input.movementAllowance,
      movementAllowanceUsed: 0,
      createdAt: new Date(),
    };
    this.byId.set(id, participation);
    return participation;
  }
  async transition(id: string, status: ParticipationStatus): Promise<Participation> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`participation "${id}" not found in test double`);
    const updated = { ...existing, status };
    this.byId.set(id, updated);
    return updated;
  }
  async countActiveByUserAndRoom(): Promise<number> {
    return 0;
  }
  async updateMovementAllocation(
    id: string,
    allocation: MovementAllocation,
  ): Promise<Participation> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`participation "${id}" not found in test double`);
    const updated: Participation = {
      ...existing,
      movementAllowanceTotal: allocation.totalAllowance,
      movementAllowanceUsed: allocation.usedCount,
    };
    this.byId.set(id, updated);
    return updated;
  }
  async listByUserAndRoom(): Promise<readonly Participation[]> {
    return [];
  }
  async listByRoomId(): Promise<readonly Participation[]> {
    return [];
  }
  async appendMovementCommand(): Promise<void> {}
  async listMovementCommandsForRoom(): Promise<readonly MovementCommand[]> {
    return [];
  }
  async lockFinalMovementPlan(
    participationId: string,
    plan: FinalMovementPlan,
  ): Promise<Participation> {
    if (this.finalPlansById.has(participationId)) {
      throw new Error("already locked in test double");
    }
    this.finalPlansById.set(participationId, plan);
    return this.transition(participationId, "LOCKED");
  }
  async findFinalMovementPlan(participationId: string): Promise<FinalMovementPlan | null> {
    return this.finalPlansById.get(participationId) ?? null;
  }
}

class InMemoryIdempotencyPort implements IdempotencyPort {
  private readonly seen = new Set<string>();
  async record(key: string): Promise<boolean> {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

const PACKAGE: ParticipationPackage = {
  id: "pkg-1",
  positionCount: 1,
  movementAllowance: 3,
  eligibilityRules: [],
};

describe("Phase 8 / TASK-046: use cases publish core funnel events to the outbox", () => {
  it("HoldPositionsUseCase publishes position.hold_created for each acquired position", async () => {
    const outbox = new RecordingOutboxPort();
    const useCase = new HoldPositionsUseCase(
      new InMemoryRoomRepository(buildRoom()),
      new InMemoryPositionHoldRepository(),
      outbox,
    );
    await useCase.execute({ roomId: "room-1", positions: [1, 2], holderRef: "user-1" });

    expect(outbox.published.map((e) => e.eventType)).toEqual([
      "position.hold_created",
      "position.hold_created",
    ]);
    expect(outbox.published[0]?.payload.userId).toBe("user-1");
  });

  it("HoldPositionsUseCase publishes position.hold_failed when a position is already held", async () => {
    const outbox = new RecordingOutboxPort();
    const holdRepository = new InMemoryPositionHoldRepository();
    await holdRepository.tryHold({
      roomId: "room-1",
      position: 2,
      holderRef: "someone-else",
      now: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const useCase = new HoldPositionsUseCase(
      new InMemoryRoomRepository(buildRoom()),
      holdRepository,
      outbox,
    );

    await expect(
      useCase.execute({ roomId: "room-1", positions: [1, 2], holderRef: "user-1" }),
    ).rejects.toThrow(ConflictError);

    expect(outbox.published.map((e) => e.eventType)).toEqual([
      "position.hold_created",
      "position.hold_failed",
    ]);
  });

  it("HoldPositionsUseCase still works with no outbox passed at all (backward compatible default)", async () => {
    const useCase = new HoldPositionsUseCase(
      new InMemoryRoomRepository(buildRoom()),
      new InMemoryPositionHoldRepository(),
    );
    const holds = await useCase.execute({ roomId: "room-1", positions: [1], holderRef: "user-1" });
    expect(holds).toHaveLength(1);
  });

  it("CreateParticipationUseCase publishes participation.started", async () => {
    const outbox = new RecordingOutboxPort();
    const useCase = new CreateParticipationUseCase(new InMemoryParticipationRepository(), outbox);
    const participation = await useCase.execute({
      roomId: "room-1",
      userId: "user-1",
      package: PACKAGE,
      positions: [4],
    });
    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]).toMatchObject({
      eventType: "participation.started",
      payload: { userId: "user-1", roomId: "room-1", participationId: participation.id },
    });
  });

  it("ConfirmParticipationUseCase publishes participation.confirmed", async () => {
    const participationRepository = new InMemoryParticipationRepository();
    const holdRepository = new InMemoryPositionHoldRepository();
    const created = await participationRepository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [1],
      movementAllowance: 3,
    });
    await participationRepository.transition(created.id, "RESERVED");
    await participationRepository.transition(created.id, "AWAITING_REQUIREMENT");

    const outbox = new RecordingOutboxPort();
    const useCase = new ConfirmParticipationUseCase(
      participationRepository,
      holdRepository,
      outbox,
    );
    await useCase.execute({ participationId: created.id });

    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]).toMatchObject({
      eventType: "participation.confirmed",
      payload: { userId: "user-1", roomId: "room-1", participationId: created.id },
    });
  });

  async function buildActiveParticipation(repository: InMemoryParticipationRepository) {
    const created = await repository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [2],
      movementAllowance: 3,
    });
    await repository.transition(created.id, "RESERVED");
    await repository.transition(created.id, "AWAITING_REQUIREMENT");
    await repository.transition(created.id, "CONFIRMED");
    return repository.transition(created.id, "ACTIVE");
  }

  it("SubmitMovementCommandUseCase publishes movement.accepted on success", async () => {
    const repository = new InMemoryParticipationRepository();
    const participation = await buildActiveParticipation(repository);
    const outbox = new RecordingOutboxPort();
    const useCase = new SubmitMovementCommandUseCase(
      repository,
      new InMemoryIdempotencyPort(),
      outbox,
    );

    await useCase.execute({
      participationId: participation.id,
      command: {
        participationId: participation.id,
        positionIndex: 0,
        direction: "RIGHT",
        sequence: 1,
      },
      idempotencyKey: "key-1",
    });

    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]?.eventType).toBe("movement.accepted");
  });

  it("SubmitMovementCommandUseCase publishes movement.rejected when the submission is invalid", async () => {
    const repository = new InMemoryParticipationRepository();
    // CREATED, not ACTIVE - assertValidMovementSubmission must reject this.
    const created = await repository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [2],
      movementAllowance: 3,
    });
    const outbox = new RecordingOutboxPort();
    const useCase = new SubmitMovementCommandUseCase(
      repository,
      new InMemoryIdempotencyPort(),
      outbox,
    );

    await expect(
      useCase.execute({
        participationId: created.id,
        command: { participationId: created.id, positionIndex: 0, direction: "RIGHT", sequence: 1 },
        idempotencyKey: "key-1",
      }),
    ).rejects.toThrow();

    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]?.eventType).toBe("movement.rejected");
  });

  it("SubmitFinalMovementCommandUseCase publishes participation.final_plan_submitted", async () => {
    const roomRepository = new InMemoryRoomRepository(buildRoom({ status: "FINAL_LOCK" }));
    const participationRepository = new InMemoryParticipationRepository();
    const participation = await buildActiveParticipation(participationRepository);
    const outbox = new RecordingOutboxPort();
    const useCase = new SubmitFinalMovementCommandUseCase(
      roomRepository,
      participationRepository,
      outbox,
    );

    await useCase.execute({
      participationId: participation.id,
      commands: [
        { participationId: participation.id, positionIndex: 0, direction: "LEFT", sequence: 6 },
      ],
      atSequence: 6,
    });

    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]).toMatchObject({
      eventType: "participation.final_plan_submitted",
      payload: { userId: "user-1", participationId: participation.id },
    });
  });
});

describe("Phase 8 / TASK-046: DispatchOutboxEventsUseCase fans out mapped events to AnalyticsPort", () => {
  class RecordingOutboxReader implements OutboxReaderPort {
    constructor(private events: OutboxEventRecord[]) {}
    async claimBatch(limit: number): Promise<readonly OutboxEventRecord[]> {
      const batch = this.events.slice(0, limit);
      this.events = this.events.slice(limit);
      return batch;
    }
    async markProcessed(): Promise<void> {}
    async markFailed(): Promise<void> {}
    async countUnprocessed(): Promise<number> {
      return this.events.length;
    }
  }

  class NoopNotificationRepository implements NotificationRepository {
    async create(input: CreateNotificationInput): Promise<Notification> {
      return {
        id: "n1",
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        readAt: null,
        createdAt: new Date(),
      };
    }
    async listByUser(): Promise<readonly Notification[]> {
      return [];
    }
    async markRead(): Promise<Notification> {
      throw new Error("not needed in this test");
    }
    async getPreference(): Promise<NotificationPreference | null> {
      return null;
    }
    async setPreference(
      userId: string,
      channel: NotificationChannel,
      enabled: boolean,
    ): Promise<NotificationPreference> {
      return { userId, channel, enabled };
    }
  }

  class RecordingAnalyticsPort {
    readonly tracked: TrackAnalyticsEventInput[] = [];
    async track(input: TrackAnalyticsEventInput): Promise<void> {
      this.tracked.push(input);
    }
  }

  function event(overrides: Partial<OutboxEventRecord>): OutboxEventRecord {
    return {
      id: "evt-1",
      aggregateType: "Participation",
      aggregateId: "agg-1",
      eventType: "movement.rejected",
      payload: {},
      attempts: 0,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("tracks a mapped event with its userId as distinctId and redacted properties", async () => {
    const analytics = new RecordingAnalyticsPort();
    const useCase = new DispatchOutboxEventsUseCase(
      new RecordingOutboxReader([
        event({
          eventType: "benefit.granted",
          payload: { userId: "user-1", benefitId: "b1", accessToken: "should-be-stripped" },
        }),
      ]),
      new NoopNotificationRepository(),
      [],
      analytics,
    );

    const dispatched = await useCase.execute({});

    expect(dispatched).toBe(1);
    expect(analytics.tracked).toHaveLength(1);
    expect(analytics.tracked[0]?.event).toBe("benefit_granted");
    expect(analytics.tracked[0]?.distinctId).toBe("user-1");
    expect(analytics.tracked[0]?.properties).toEqual({ userId: "user-1", benefitId: "b1" });
    expect(analytics.tracked[0]?.properties).not.toHaveProperty("accessToken");
  });

  it("falls back to the aggregateId as distinctId when the event has no userId", async () => {
    const analytics = new RecordingAnalyticsPort();
    const useCase = new DispatchOutboxEventsUseCase(
      new RecordingOutboxReader([
        event({ eventType: "position.hold_failed", aggregateId: "room-1", payload: {} }),
      ]),
      new NoopNotificationRepository(),
      [],
      analytics,
    );

    await useCase.execute({});

    expect(analytics.tracked[0]?.distinctId).toBe("room-1");
  });

  it("does not track an outbox event type with no analytics mapping", async () => {
    const analytics = new RecordingAnalyticsPort();
    const useCase = new DispatchOutboxEventsUseCase(
      new RecordingOutboxReader([event({ eventType: "room.completed", payload: {} })]),
      new NoopNotificationRepository(),
      [],
      analytics,
    );

    await useCase.execute({});

    expect(analytics.tracked).toHaveLength(0);
  });

  it("still dispatches notifications normally when analytics is left at its default no-op", async () => {
    const useCase = new DispatchOutboxEventsUseCase(
      new RecordingOutboxReader([
        event({ eventType: "participation.won", payload: { userId: "user-1", roomId: "room-1" } }),
      ]),
      new NoopNotificationRepository(),
    );

    const dispatched = await useCase.execute({});
    expect(dispatched).toBe(1);
  });
});
