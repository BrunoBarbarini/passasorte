/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameConfigSnapshot, GameRoom, Position, PositionHold } from "@passasorte/domain";
import { HoldPositionsUseCase } from "../use-cases/room/hold-positions.use-case.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import type {
  PositionHoldRepository,
  TryHoldInput,
} from "../ports/position-hold-repository.port.js";
import { ConflictError } from "../errors.js";

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
    status: "OPEN",
    createdAt: new Date(),
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

  async create(): Promise<GameRoom> {
    throw new Error("not needed in this test");
  }

  async transition(_id: string, status: GameRoom["status"]): Promise<GameRoom> {
    this.room = { ...this.room, status };
    return this.room;
  }
}

/**
 * In-memory double whose `tryHold` performs its check-then-set with no
 * `await` in between, so JS's run-to-completion semantics make it
 * genuinely atomic across "concurrent" (interleaved microtask) callers —
 * exactly the contract BR-010 requires from a real adapter (there, a DB
 * unique constraint or row lock).
 */
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
      if (hold.id === holdId) {
        this.holdsByKey.set(key, { ...hold, status: "RELEASED" });
      }
    }
  }

  async findActiveHold(roomId: string, position: Position, now: Date): Promise<PositionHold | null> {
    const hold = this.holdsByKey.get(this.key(roomId, position));
    if (!hold || hold.status !== "ACTIVE" || hold.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    return hold;
  }
}

describe("HoldPositionsUseCase (FR-022..FR-024)", () => {
  it("holds every requested position when all are free", async () => {
    const useCase = new HoldPositionsUseCase(
      new InMemoryRoomRepository(buildRoom()),
      new InMemoryPositionHoldRepository(),
    );
    const holds = await useCase.execute({
      roomId: "room-1",
      positions: [1, 2, 3],
      holderRef: "user-1",
      holdPolicy: { ttlMs: 60_000 },
    });
    expect(holds.map((h) => h.position)).toEqual([1, 2, 3]);
  });

  it("rejects holding a room that isn't OPEN", async () => {
    const useCase = new HoldPositionsUseCase(
      new InMemoryRoomRepository(buildRoom({ status: "RUNNING" })),
      new InMemoryPositionHoldRepository(),
    );
    await expect(
      useCase.execute({
        roomId: "room-1",
        positions: [1],
        holderRef: "u1",
        holdPolicy: { ttlMs: 1000 },
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("BR-010: exactly one of many concurrent attempts on the same position wins", async () => {
    const holdRepository = new InMemoryPositionHoldRepository();
    const roomRepository = new InMemoryRoomRepository(buildRoom());
    const attempts = Array.from({ length: 20 }, (_, i) =>
      new HoldPositionsUseCase(roomRepository, holdRepository).execute({
        roomId: "room-1",
        positions: [5],
        holderRef: `user-${i}`,
        holdPolicy: { ttlMs: 60_000 },
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
  });

  it("releases everything already acquired in a batch if one position is unavailable", async () => {
    const holdRepository = new InMemoryPositionHoldRepository();
    const roomRepository = new InMemoryRoomRepository(buildRoom());
    await holdRepository.tryHold({
      roomId: "room-1",
      position: 2,
      holderRef: "someone-else",
      now: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new HoldPositionsUseCase(roomRepository, holdRepository);
    await expect(
      useCase.execute({
        roomId: "room-1",
        positions: [1, 2],
        holderRef: "user-1",
        holdPolicy: { ttlMs: 60_000 },
      }),
    ).rejects.toThrow(ConflictError);

    const positionOneHold = await holdRepository.findActiveHold("room-1", 1, new Date());
    expect(positionOneHold).toBeNull();
  });
});
