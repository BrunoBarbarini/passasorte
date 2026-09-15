/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameConfigSnapshot, GameRoom, RoomStatus } from "@passasorte/domain";
import { OpenRoomUseCase } from "../use-cases/room/open-room.use-case.js";
import type { CreateRoomInput, RoomRepository } from "../ports/room-repository.port.js";
import { NotFoundError } from "../errors.js";

const GAME_CONFIG: GameConfigSnapshot = {
  engineVersion: "SIMULATION_V1",
  board: { size: 10 },
  initialSorteZone: { start: 4, end: 5 },
  temperatureBands: [{ name: "UNICA", maxNormalizedDistance: 1 }],
  movementAllowancePerParticipation: 3,
  finalLock: { finalPhaseStartSequence: 5 },
};

const PACKAGES = [{ id: "pkg-1", positionCount: 1, movementAllowance: 3, eligibilityRules: [] }];

const OPERATIONS_CONFIG = { finalLockGracePeriodMs: 30_000 };

function fakeRoom(status: RoomStatus): GameRoom {
  return {
    id: "room-1",
    campaignId: "campaign-1",
    capacity: 10,
    gameConfig: GAME_CONFIG,
    holdTtlMs: 60_000,
    participationPackages: PACKAGES,
    operationsConfig: OPERATIONS_CONFIG,
    status,
    createdAt: new Date(),
    finalLockedAt: null,
    cancelledAt: null,
    cancellationReason: null,
  };
}

class InMemoryRoomRepository implements RoomRepository {
  public transitionedTo: RoomStatus | undefined;

  constructor(private room: GameRoom | null) {}

  async findById(): Promise<GameRoom | null> {
    return this.room;
  }

  async create(_input: CreateRoomInput): Promise<GameRoom> {
    throw new Error("not needed in this test");
  }

  async transition(_id: string, status: RoomStatus, _at: Date): Promise<GameRoom> {
    this.transitionedTo = status;
    this.room = { ...(this.room as GameRoom), status };
    return this.room;
  }

  async listByCampaignId(): Promise<readonly GameRoom[]> {
    return [];
  }

  async listByStatus(): Promise<readonly GameRoom[]> {
    return [];
  }
}

describe("OpenRoomUseCase", () => {
  it("moves a DRAFT room to OPEN", async () => {
    const repository = new InMemoryRoomRepository(fakeRoom("DRAFT"));
    const useCase = new OpenRoomUseCase(repository);

    const room = await useCase.execute({ roomId: "room-1" });

    expect(room.status).toBe("OPEN");
    expect(repository.transitionedTo).toBe("OPEN");
  });

  it("rejects opening a room that is not DRAFT (illegal state-machine transition)", async () => {
    const repository = new InMemoryRoomRepository(fakeRoom("OPEN"));
    const useCase = new OpenRoomUseCase(repository);

    await expect(useCase.execute({ roomId: "room-1" })).rejects.toThrow();
    expect(repository.transitionedTo).toBeUndefined();
  });

  it("raises NotFoundError when the room does not exist", async () => {
    const repository = new InMemoryRoomRepository(null);
    const useCase = new OpenRoomUseCase(repository);

    await expect(useCase.execute({ roomId: "does-not-exist" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
