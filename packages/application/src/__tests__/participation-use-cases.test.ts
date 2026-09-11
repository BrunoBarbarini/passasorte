/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type {
  EligibilityRule,
  MovementAllocation,
  Participation,
  ParticipationPackage,
  ParticipationStatus,
  Position,
  PositionHold,
} from "@passasorte/domain";
import { CreateParticipationUseCase } from "../use-cases/participation/create-participation.use-case.js";
import { ConfirmParticipationUseCase } from "../use-cases/participation/confirm-participation.use-case.js";
import { SubmitMovementCommandUseCase } from "../use-cases/participation/submit-movement-command.use-case.js";
import type {
  CreateParticipationInput,
  ParticipationRepository,
} from "../ports/participation-repository.port.js";
import type { PositionHoldRepository, TryHoldInput } from "../ports/position-hold-repository.port.js";
import type { IdempotencyPort } from "../ports/idempotency.port.js";
import { ConflictError, ValidationError } from "../errors.js";

class InMemoryParticipationRepository implements ParticipationRepository {
  private nextId = 1;
  private readonly byId = new Map<string, Participation>();

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
    if (!existing) {
      throw new Error(`participation "${id}" not found in test double`);
    }
    const updated = { ...existing, status };
    this.byId.set(id, updated);
    return updated;
  }

  async countActiveByUserAndRoom(): Promise<number> {
    return 0;
  }

  async updateMovementAllocation(id: string, allocation: MovementAllocation): Promise<Participation> {
    const existing = this.byId.get(id);
    if (!existing) {
      throw new Error(`participation "${id}" not found in test double`);
    }
    const updated: Participation = {
      ...existing,
      movementAllowanceTotal: allocation.totalAllowance,
      movementAllowanceUsed: allocation.usedCount,
    };
    this.byId.set(id, updated);
    return updated;
  }

  async listByUserAndRoom(userId: string, roomId: string): Promise<readonly Participation[]> {
    return [...this.byId.values()].filter((p) => p.userId === userId && p.roomId === roomId);
  }
}

class InMemoryIdempotencyPort implements IdempotencyPort {
  private readonly seen = new Set<string>();

  async record(key: string): Promise<boolean> {
    if (this.seen.has(key)) {
      return false;
    }
    this.seen.add(key);
    return true;
  }
}

class InMemoryPositionHoldRepository implements PositionHoldRepository {
  private nextId = 1;
  private readonly holdsByKey = new Map<string, PositionHold>();

  private key(roomId: string, position: Position): string {
    return `${roomId}:${position}`;
  }

  async tryHold(input: TryHoldInput): Promise<PositionHold | null> {
    const hold: PositionHold = {
      id: `hold-${this.nextId++}`,
      roomId: input.roomId,
      position: input.position,
      holderRef: input.holderRef,
      status: "ACTIVE",
      heldAt: input.now,
      expiresAt: input.expiresAt,
    };
    this.holdsByKey.set(this.key(input.roomId, input.position), hold);
    return hold;
  }

  async release(): Promise<void> {}

  async findActiveHold(roomId: string, position: Position): Promise<PositionHold | null> {
    return this.holdsByKey.get(this.key(roomId, position)) ?? null;
  }

  async commitHold(roomId: string, position: Position): Promise<void> {
    const key = this.key(roomId, position);
    const hold = this.holdsByKey.get(key);
    if (hold) this.holdsByKey.set(key, { ...hold, status: "COMMITTED" });
  }

  async listForRoom(roomId: string): Promise<readonly PositionHold[]> {
    return [...this.holdsByKey.values()].filter((h) => h.roomId === roomId);
  }
}

const PACKAGE: ParticipationPackage = {
  id: "pkg-1",
  positionCount: 1,
  movementAllowance: 3,
  eligibilityRules: [],
};

describe("CreateParticipationUseCase (FR-027/FR-028)", () => {
  it("creates a participation, advancing it to AWAITING_REQUIREMENT", async () => {
    const useCase = new CreateParticipationUseCase(new InMemoryParticipationRepository());
    const participation = await useCase.execute({
      roomId: "room-1",
      userId: "user-1",
      package: PACKAGE,
      positions: [4],
    });
    expect(participation.status).toBe("AWAITING_REQUIREMENT");
    expect(participation.movementAllowanceTotal).toBe(3);
    expect(participation.movementAllowanceUsed).toBe(0);
    expect(participation.positions).toEqual([{ participationId: participation.id, position: 4 }]);
  });

  it("rejects a position count mismatch with the package", async () => {
    const useCase = new CreateParticipationUseCase(new InMemoryParticipationRepository());
    await expect(
      useCase.execute({ roomId: "room-1", userId: "user-1", package: PACKAGE, positions: [4, 5] }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects when a configured eligibility rule fails", async () => {
    const blockingRule: EligibilityRule = {
      id: "TEST_BLOCK",
      evaluate: () => ({ ruleId: "TEST_BLOCK", message: "Bloqueado para teste." }),
    };
    const useCase = new CreateParticipationUseCase(new InMemoryParticipationRepository());
    await expect(
      useCase.execute({
        roomId: "room-1",
        userId: "user-1",
        package: { ...PACKAGE, eligibilityRules: [blockingRule] },
        positions: [4],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("ConfirmParticipationUseCase (FR-026/FR-030)", () => {
  it("confirms a participation that is AWAITING_REQUIREMENT and commits its holds", async () => {
    const participationRepository = new InMemoryParticipationRepository();
    const holdRepository = new InMemoryPositionHoldRepository();
    await holdRepository.tryHold({
      roomId: "room-1",
      position: 1,
      holderRef: "user-1",
      now: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const created = await participationRepository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [1],
      movementAllowance: 3,
    });
    await participationRepository.transition(created.id, "RESERVED");
    await participationRepository.transition(created.id, "AWAITING_REQUIREMENT");

    const useCase = new ConfirmParticipationUseCase(participationRepository, holdRepository);
    const confirmed = await useCase.execute({ participationId: created.id });
    expect(confirmed.status).toBe("CONFIRMED");

    const holds = await holdRepository.listForRoom("room-1");
    expect(holds[0]?.status).toBe("COMMITTED");
  });

  it("rejects confirming a participation still CREATED (illegal transition)", async () => {
    const participationRepository = new InMemoryParticipationRepository();
    const holdRepository = new InMemoryPositionHoldRepository();
    const created = await participationRepository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [1],
      movementAllowance: 3,
    });
    const useCase = new ConfirmParticipationUseCase(participationRepository, holdRepository);
    await expect(useCase.execute({ participationId: created.id })).rejects.toThrow();
  });
});

describe("SubmitMovementCommandUseCase (FR-037/FR-038)", () => {
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

  it("spends one movement on a valid, first-time submission", async () => {
    const repository = new InMemoryParticipationRepository();
    const participation = await buildActiveParticipation(repository);

    const useCase = new SubmitMovementCommandUseCase(repository, new InMemoryIdempotencyPort());
    const result = await useCase.execute({
      participationId: participation.id,
      command: {
        participationId: participation.id,
        positionIndex: 0,
        direction: "RIGHT",
        sequence: 1,
      },
      idempotencyKey: "key-1",
    });
    expect(result.participation.movementAllowanceUsed).toBe(1);
  });

  it("rejects a duplicate submission with the same idempotency key (FR-038)", async () => {
    const repository = new InMemoryParticipationRepository();
    const participation = await buildActiveParticipation(repository);

    const idempotency = new InMemoryIdempotencyPort();
    const useCase = new SubmitMovementCommandUseCase(repository, idempotency);
    const command = {
      participationId: participation.id,
      positionIndex: 0,
      direction: "RIGHT" as const,
      sequence: 1,
    };

    await useCase.execute({ participationId: participation.id, command, idempotencyKey: "same-key" });
    await expect(
      useCase.execute({ participationId: participation.id, command, idempotencyKey: "same-key" }),
    ).rejects.toThrow(ConflictError);
  });
});
