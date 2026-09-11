/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameConfigSnapshot, GameRoom } from "@passasorte/domain";
import { CreateRoomUseCase } from "../use-cases/room/create-room.use-case.js";
import type { CreateRoomInput, RoomRepository } from "../ports/room-repository.port.js";

const GAME_CONFIG: GameConfigSnapshot = {
  engineVersion: "SIMULATION_V1",
  board: { size: 10 },
  initialSorteZone: { start: 4, end: 5 },
  temperatureBands: [{ name: "UNICA", maxNormalizedDistance: 1 }],
  movementAllowancePerParticipation: 3,
  finalLock: { finalPhaseStartSequence: 5 },
};

const PACKAGES = [
  { id: "pkg-1", positionCount: 1, movementAllowance: 3, eligibilityRules: [] },
];

class InMemoryRoomRepository implements RoomRepository {
  public created: CreateRoomInput | undefined;

  async findById(): Promise<GameRoom | null> {
    return null;
  }

  async create(input: CreateRoomInput): Promise<GameRoom> {
    this.created = input;
    return {
      id: "room-1",
      campaignId: input.campaignId,
      capacity: input.capacity,
      gameConfig: input.gameConfig,
      holdTtlMs: input.holdTtlMs,
      participationPackages: input.participationPackages,
      status: "DRAFT",
      createdAt: new Date(),
      cancelledAt: null,
      cancellationReason: null,
    };
  }

  async transition(): Promise<GameRoom> {
    throw new Error("not needed in this test");
  }

  async listByCampaignId(): Promise<readonly GameRoom[]> {
    return [];
  }
}

describe("CreateRoomUseCase (TASK-024)", () => {
  it("creates a room when every value is valid", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    const room = await useCase.execute({
      campaignId: "campaign-1",
      capacity: 10,
      gameConfig: GAME_CONFIG,
      holdTtlMs: 60_000,
      participationPackages: PACKAGES,
    });
    expect(room.capacity).toBe(10);
    expect(repository.created?.holdTtlMs).toBe(60_000);
  });

  it("rejects a non-positive capacity (BR-004) without ever reaching the repository", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    await expect(
      useCase.execute({
        campaignId: "campaign-1",
        capacity: 0,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: PACKAGES,
      }),
    ).rejects.toThrow();
    expect(repository.created).toBeUndefined();
  });

  it("rejects an empty participation package list", async () => {
    const repository = new InMemoryRoomRepository();
    const useCase = new CreateRoomUseCase(repository);
    await expect(
      useCase.execute({
        campaignId: "campaign-1",
        capacity: 10,
        gameConfig: GAME_CONFIG,
        holdTtlMs: 60_000,
        participationPackages: [],
      }),
    ).rejects.toThrow();
  });
});
