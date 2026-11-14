/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import type { GameRoom, Participation } from "@passasorte/domain";
import { StartPositionSelectionUseCase } from "../use-cases/game/start-position-selection.use-case.js";
import { PickPositionsUseCase } from "../use-cases/game/pick-positions.use-case.js";
import { AutoAllocateExpiredPicksUseCase } from "../use-cases/game/auto-allocate-expired-picks.use-case.js";
import type {
  CommitPickInput,
  CommitSelectionStartInput,
  PositionSelectionPort,
  SelectionAssignment,
  SelectionSnapshot,
} from "../ports/position-selection.port.js";
import type { ParticipationRepository } from "../ports/participation-repository.port.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import { ConflictError, DomainError, ValidationError } from "../errors.js";

const T0 = new Date("2026-11-14T12:00:00.000Z");
const at = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000);
const SEED = "cd".repeat(32);
const WINDOW_MS = 60_000;

/** a: 2 positions, b: 3, c: 1 -> board of 6; entry order a, b, c. */
class Fixture {
  room = {
    id: "room",
    status: "ENTRY_LOCKED",
    participationPackages: [
      { id: "p2", positionCount: 2, movementAllowance: 4 },
      { id: "p3", positionCount: 3, movementAllowance: 4 },
      { id: "p1", positionCount: 1, movementAllowance: 4 },
    ],
    positionSelection: null,
  } as unknown as GameRoom & { status: string; positionSelection: unknown };
  entries = [
    { participationId: "a", entrySequence: 1, packageId: "p2" },
    { participationId: "b", entrySequence: 2, packageId: "p3" },
    { participationId: "c", entrySequence: 3, packageId: "p1" },
  ];
  assignments: SelectionAssignment[] = [];
  seed: { seedHex: string; commitmentHash: string } | null = null;
  started: CommitSelectionStartInput[] = [];
  staleOnce = false;
  now = at(0);

  rooms = {
    findById: async () => this.room,
  } as unknown as RoomRepository;
  participations = {
    findById: async (id: string) =>
      this.entries.some((e) => e.participationId === id)
        ? ({ id, roomId: "room", status: "CONFIRMED" } as unknown as Participation)
        : null,
  } as unknown as ParticipationRepository;

  port: PositionSelectionPort = {
    loadSnapshot: async (): Promise<SelectionSnapshot> => ({
      entries: this.entries,
      assignments: this.assignments,
    }),
    commitSelectionStart: async (input) => {
      this.started.push(input);
      this.seed = { seedHex: input.seedHex, commitmentHash: input.commitmentHash };
      (this.room as { status: string }).status = "POSITION_SELECTION";
      (this.room as { positionSelection: unknown }).positionSelection = {
        pickWindowMs: input.pickWindowMs,
        startedAt: input.startedAt.toISOString(),
        boardSize: input.boardSize,
      };
      return this.room;
    },
    loadSealedSeed: async () => this.seed,
    commitPick: async (input: CommitPickInput) => {
      if (this.staleOnce) {
        this.staleOnce = false;
        throw new ConflictError("Outra escolha foi registrada primeiro.");
      }
      if (input.expectedPickCount !== this.assignments.length) throw new ConflictError("stale");
      this.assignments.push({
        participationId: input.participationId,
        positions: input.positions,
        pickedAt: input.pickedAt,
        kind: input.kind,
      });
      const completed = this.assignments.length === this.entries.length;
      if (completed) (this.room as { status: string }).status = "READY";
      return { completed };
    },
    listRoomIdsInSelection: async () => ["room"],
  };

  start = () =>
    new StartPositionSelectionUseCase(
      this.rooms,
      this.port,
      () => this.now,
      () => SEED,
    );
  pick = () => new PickPositionsUseCase(this.participations, this.rooms, this.port, () => this.now);
  auto = () => new AutoAllocateExpiredPicksUseCase(this.rooms, this.port, () => this.now);

  async begin(): Promise<void> {
    await this.start().execute({ roomId: "room", pickWindowMs: WINDOW_MS });
  }
}

describe("StartPositionSelectionUseCase", () => {
  it("computes the board as the sum of position credits and seals the seed", async () => {
    const fx = new Fixture();
    await fx.begin();
    const started = fx.started[0] as CommitSelectionStartInput;
    expect(started.boardSize).toBe(6);
    expect(started.pickWindowMs).toBe(WINDOW_MS);
    expect(started.commitmentHash).toHaveLength(64);
    expect(started.events[0]?.eventType).toBe("selection.started");
  });

  it("requires ENTRY_LOCKED, a positive window and entry order for every seat", async () => {
    const wrongState = new Fixture();
    (wrongState.room as { status: string }).status = "OPEN";
    await expect(wrongState.begin()).rejects.toBeInstanceOf(DomainError);

    const badWindow = new Fixture();
    await expect(
      badWindow.start().execute({ roomId: "room", pickWindowMs: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    const noOrder = new Fixture();
    noOrder.entries = [
      { participationId: "a", entrySequence: null as unknown as number, packageId: "p2" },
    ];
    await expect(noOrder.begin()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("PickPositionsUseCase", () => {
  it("lets each participant pick exactly their count, in entry order, until READY", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await expect(
      fx.pick().execute({ participationId: "b", positions: [1, 2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "NOT_YOUR_PICK_TURN" },
    });
    expect(await fx.pick().execute({ participationId: "a", positions: [6, 1] })).toMatchObject({
      positions: [1, 6],
      completed: false,
    });
    await expect(
      fx.pick().execute({ participationId: "b", positions: [1, 2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "POSITION_UNAVAILABLE" },
    });
    await expect(
      fx.pick().execute({ participationId: "b", positions: [2, 3] }),
    ).rejects.toMatchObject({
      details: { reason: "WRONG_POSITION_COUNT" },
    });
    await fx.pick().execute({ participationId: "b", positions: [2, 3, 4] });
    const last = await fx.pick().execute({ participationId: "c", positions: [5] });
    expect(last.completed).toBe(true);
    expect(fx.room.status).toBe("READY");
  });

  it("is idempotent for the same choice and rejects changing it", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(5);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    expect(await fx.pick().execute({ participationId: "a", positions: [2, 1] })).toMatchObject({
      idempotentReplay: true,
    });
    await expect(
      fx.pick().execute({ participationId: "a", positions: [3, 4] }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(fx.assignments).toHaveLength(1);
  });

  it("rejects a manual pick after the turn expired and outside the selection phase", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).rejects.toBeInstanceOf(DomainError);
    (fx.room as { status: string }).status = "READY";
    fx.now = at(5);
    await expect(
      fx.pick().execute({ participationId: "a", positions: [1, 2] }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("the next turn starts when the previous participant picked", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(50);
    await fx.pick().execute({ participationId: "a", positions: [1, 2] });
    fx.now = at(100); // 50s after a's pick: still inside b's 60s turn
    await fx.pick().execute({ participationId: "b", positions: [3, 4, 5] });
    fx.now = at(161); // 61s after b's pick: c is late
    await expect(
      fx.pick().execute({ participationId: "c", positions: [6] }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("AutoAllocateExpiredPicksUseCase", () => {
  it("does nothing while the turn is open", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(30);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(0);
    expect(fx.assignments).toHaveLength(0);
  });

  it("allocates only the expired turn, then waits for the next one", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(1);
    expect(fx.assignments[0]).toMatchObject({ participationId: "a", kind: "AUTOMATIC" });
    expect(fx.assignments[0]?.positions).toHaveLength(2);
    expect(await fx.auto().execute({ roomId: "room" })).toBe(0);
  });

  it("finishes the selection with no empty position, deterministically", async () => {
    const run = async (): Promise<string> => {
      const fx = new Fixture();
      await fx.begin();
      fx.now = at(61);
      await fx.auto().execute({ roomId: "room" });
      fx.now = at(200);
      await fx.auto().execute({ roomId: "room" });
      fx.now = at(400);
      await fx.auto().execute({ roomId: "room" });
      expect(fx.room.status).toBe("READY");
      const all = fx.assignments.flatMap((a) => a.positions).sort((x, y) => x - y);
      expect(all).toEqual([1, 2, 3, 4, 5, 6]);
      return JSON.stringify(fx.assignments.map((a) => [a.participationId, a.positions]));
    };
    expect(await run()).toBe(await run());
  });

  it("surfaces a stale decision as a conflict instead of overwriting", async () => {
    const fx = new Fixture();
    await fx.begin();
    fx.now = at(61);
    fx.staleOnce = true;
    await expect(fx.auto().execute({ roomId: "room" })).rejects.toBeInstanceOf(ConflictError);
  });
});
