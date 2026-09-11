/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type {
  EligibilityRule,
  MovementAllocation,
  Participation,
  ParticipationPackage,
  ParticipationStatus,
} from "@passasorte/domain";
import { CreateParticipationUseCase } from "../use-cases/participation/create-participation.use-case.js";
import { ConfirmParticipationUseCase } from "../use-cases/participation/confirm-participation.use-case.js";
import { SubmitMovementCommandUseCase } from "../use-cases/participation/submit-movement-command.use-case.js";
import type {
  CreateParticipationInput,
  ParticipationRepository,
} from "../ports/participation-repository.port.js";
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

const PACKAGE: ParticipationPackage = {
  id: "pkg-1",
  positionCount: 1,
  movementAllowance: 3,
  eligibilityRules: [],
};

describe("CreateParticipationUseCase (FR-027/FR-028)", () => {
  it("creates a participation when positions match the package and eligibility passes", async () => {
    const useCase = new CreateParticipationUseCase(new InMemoryParticipationRepository());
    const participation = await useCase.execute({
      roomId: "room-1",
      userId: "user-1",
      package: PACKAGE,
      positions: [4],
    });
    expect(participation.status).toBe("CREATED");
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

describe("ConfirmParticipationUseCase (FR-030)", () => {
  it("confirms a participation that is AWAITING_REQUIREMENT", async () => {
    const repository = new InMemoryParticipationRepository();
    const created = await repository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [1],
    });
    await repository.transition(created.id, "RESERVED");
    await repository.transition(created.id, "AWAITING_REQUIREMENT");

    const useCase = new ConfirmParticipationUseCase(repository);
    const confirmed = await useCase.execute({ participationId: created.id });
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("rejects confirming a participation still CREATED (illegal transition)", async () => {
    const repository = new InMemoryParticipationRepository();
    const created = await repository.create({
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [1],
    });
    const useCase = new ConfirmParticipationUseCase(repository);
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
    const allocation: MovementAllocation = {
      participationId: participation.id,
      totalAllowance: 3,
      usedCount: 0,
    };
    const result = await useCase.execute({
      participationId: participation.id,
      command: {
        participationId: participation.id,
        positionIndex: 0,
        direction: "RIGHT",
        sequence: 1,
      },
      allocation,
      idempotencyKey: "key-1",
    });
    expect(result.allocation.usedCount).toBe(1);
  });

  it("rejects a duplicate submission with the same idempotency key (FR-038)", async () => {
    const repository = new InMemoryParticipationRepository();
    const participation = await buildActiveParticipation(repository);

    const idempotency = new InMemoryIdempotencyPort();
    const useCase = new SubmitMovementCommandUseCase(repository, idempotency);
    const allocation: MovementAllocation = {
      participationId: participation.id,
      totalAllowance: 3,
      usedCount: 0,
    };
    const command = {
      participationId: participation.id,
      positionIndex: 0,
      direction: "RIGHT" as const,
      sequence: 1,
    };

    await useCase.execute({
      participationId: participation.id,
      command,
      allocation,
      idempotencyKey: "same-key",
    });
    await expect(
      useCase.execute({
        participationId: participation.id,
        command,
        allocation,
        idempotencyKey: "same-key",
      }),
    ).rejects.toThrow(ConflictError);
  });
});
