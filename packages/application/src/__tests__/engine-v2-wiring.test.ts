/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import { gameV2 } from "@passasorte/domain";
import type { GameRoom } from "@passasorte/domain";
import { StartRoomV2UseCase } from "../use-cases/game/start-room-v2.use-case.js";
import { ResolveRoundV2UseCase } from "../use-cases/game/resolve-round-v2.use-case.js";
import type {
  CommitRoomStartInput,
  CommitRoundResolutionInput,
  EngineV2ResolutionPort,
  EngineV2StartPort,
  RoomStartSeat,
  RoundResolutionContext,
} from "../ports/engine-v2-room.port.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import { DomainError, ValidationError } from "../errors.js";

const T = (minute: number): Date => new Date(Date.UTC(2026, 10, 13, 13, minute));
const SEED = "ab".repeat(32);
const config: gameV2.GameConfigV2 = { winningZoneSize: 1, maxMovementsPerRound: 3 };
const schedule: gameV2.RoundScheduleEntry[] = [
  { roundNo: 1, windowOpensAt: T(0), windowClosesAt: T(10) },
  { roundNo: 2, windowOpensAt: T(10), windowClosesAt: T(20) },
];
const seats: RoomStartSeat[] = [
  { participationId: "a", entrySequence: 1, positions: [1, 2], movementAllowance: 4 },
  { participationId: "b", entrySequence: 2, positions: [3, 4], movementAllowance: 4 },
];

function rooms(status = "ENTRY_LOCKED"): RoomRepository {
  return {
    findById: async (id: string) => ({ id, status }) as unknown as GameRoom,
  } as unknown as RoomRepository;
}

function startPort(list: RoomStartSeat[] = seats) {
  const committed: CommitRoomStartInput[] = [];
  const port: EngineV2StartPort = {
    listConfirmedSeats: async () => list,
    commitStart: async (input) => {
      committed.push(input);
      return { id: input.roomId, status: "RUNNING" } as unknown as GameRoom;
    },
  };
  return { port, committed };
}

describe("StartRoomV2UseCase", () => {
  const start = (list?: RoomStartSeat[], status?: string) => {
    const fake = startPort(list);
    const useCase = new StartRoomV2UseCase(
      rooms(status),
      fake.port,
      () => T(0),
      () => SEED,
    );
    return { ...fake, useCase };
  };

  it("freezes config, commitment, initial Sorte and the schedule", async () => {
    const { useCase, committed } = start();
    await useCase.execute({ roomId: "r", config, schedule });
    expect(committed).toHaveLength(1);
    const c = committed[0] as CommitRoomStartInput;
    expect(c.initialSorte.boardSize).toBe(4);
    expect(c.initialSorte.initialLuckPosition).toBeGreaterThanOrEqual(1);
    expect(c.initialSorte.initialLuckPosition).toBeLessThanOrEqual(4);
    expect(c.config).toEqual(config);
    expect(c.schedule).toHaveLength(2);
    expect(c.participationIds).toEqual(["a", "b"]);
    expect(c.events[0]?.eventType).toBe("room.started");
  });

  it("requires the room to be ENTRY_LOCKED", async () => {
    const { useCase } = start(undefined, "OPEN");
    await expect(useCase.execute({ roomId: "r", config, schedule })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("rejects a missing per-round cap (BR-089)", async () => {
    const { useCase, committed } = start();
    await expect(
      useCase.execute({
        roomId: "r",
        config: { winningZoneSize: 1, maxMovementsPerRound: null },
        schedule,
      }),
    ).rejects.toMatchObject({ details: { reason: "ROUND_CAP_REQUIRED" } });
    expect(committed).toHaveLength(0);
  });

  it("rejects an invalid schedule and positions that do not tile the bar", async () => {
    const { useCase } = start();
    await expect(useCase.execute({ roomId: "r", config, schedule: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const gap = start([
      { participationId: "a", entrySequence: 1, positions: [1, 2], movementAllowance: 4 },
      { participationId: "b", entrySequence: 2, positions: [5, 6], movementAllowance: 4 },
    ]);
    await expect(gap.useCase.execute({ roomId: "r", config, schedule })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(gap.committed).toHaveLength(0);
  });

  it("rejects an empty room and a seat without entry order", async () => {
    await expect(
      start([]).useCase.execute({ roomId: "r", config, schedule }),
    ).rejects.toBeInstanceOf(DomainError);
    const noSeq = start([
      { participationId: "a", entrySequence: null, positions: [1], movementAllowance: 1 },
    ]);
    await expect(noSeq.useCase.execute({ roomId: "r", config, schedule })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

/** In-memory resolution port that builds on the real start output. */
class ResolutionFixture implements EngineV2ResolutionPort {
  resolvedRounds = new Set<number>();
  priorSteps: gameV2.ReplayStep[] = [];
  submissions = new Map<number, gameV2.StoredSubmission[]>();
  commits: CommitRoundResolutionInput[] = [];
  initialSorte: gameV2.InitialSorteRecord;
  constructor() {
    const hash = gameV2 as unknown as {
      createInitialSorteRecord: typeof gameV2.createInitialSorteRecord;
    };
    // commitment = sha256(seed bytes); computed through the same domain helper used by start.
    this.initialSorte = hash.createInitialSorteRecord({
      gameId: "r",
      boardSize: 4,
      sealedSeedHex: SEED,
      randomnessCommitmentHash: commitmentOf(SEED),
      generatedAt: T(0).toISOString(),
    });
  }
  async findDueRounds() {
    return [];
  }
  async loadResolutionContext(roundId: string): Promise<RoundResolutionContext | null> {
    const roundNo = Number(roundId.replace("round", ""));
    if (this.resolvedRounds.has(roundNo)) return null;
    const entry = schedule[roundNo - 1] as gameV2.RoundScheduleEntry;
    return {
      round: {
        id: roundId,
        roomId: "r",
        roundNo,
        windowOpensAt: entry.windowOpensAt,
        windowClosesAt: entry.windowClosesAt,
        isLast: roundNo === schedule.length,
      },
      config,
      initialSorte: this.initialSorte,
      seats: seats.map((s) => ({
        participationId: s.participationId,
        entrySequence: s.entrySequence as number,
        positions: s.positions,
        movementAllowanceTotal: s.movementAllowance,
      })),
      priorSteps: this.priorSteps,
      submissions: this.submissions.get(roundNo) ?? [],
    };
  }
  async commitResolution(input: CommitRoundResolutionInput) {
    const roundNo = Number(input.roundId.replace("round", ""));
    if (this.resolvedRounds.has(roundNo)) return { alreadyResolved: true };
    this.resolvedRounds.add(roundNo);
    this.priorSteps = [...this.priorSteps, ...input.resolution.steps];
    this.commits.push(input);
    return { alreadyResolved: false };
  }
}

import { createHash } from "node:crypto";
function commitmentOf(seedHex: string): string {
  return createHash("sha256").update(seedHex, "hex").digest("hex");
}

describe("ResolveRoundV2UseCase", () => {
  const sub = (
    id: string,
    seq: number,
    kind: "LEFT" | "RIGHT",
    credits: number,
    at: Date,
  ): gameV2.StoredSubmission => ({
    participantId: id,
    kind,
    credits,
    submittedAt: at.toISOString(),
    submissionSequence: seq,
  });

  it("does not resolve while the window is still open", async () => {
    const fx = new ResolutionFixture();
    const useCase = new ResolveRoundV2UseCase(fx, () => T(5));
    await expect(useCase.execute({ roundId: "round1" })).rejects.toBeInstanceOf(DomainError);
    expect(fx.commits).toHaveLength(0);
  });

  it("resolves round 1 using the last submission, then completes on the last round", async () => {
    const fx = new ResolutionFixture();
    fx.submissions.set(1, [sub("a", 1, "LEFT", 3, T(1)), sub("a", 2, "RIGHT", 2, T(2))]);

    const first = await new ResolveRoundV2UseCase(fx, () => T(10)).execute({ roundId: "round1" });
    expect(first).toEqual({ status: "RESOLVED", roundNo: 1, completed: false });
    const c1 = fx.commits[0] as CommitRoundResolutionInput;
    expect(c1.completion).toBeNull();
    const rowA = c1.resolution.audit.find((r) => r.participantId === "a");
    expect(rowA).toMatchObject({ action: "RIGHT", movementsConsumed: 2, executionType: "MANUAL" });
    const rowB = c1.resolution.audit.find((r) => r.participantId === "b");
    expect(rowB).toMatchObject({ outcome: "SKIPPED", skipReason: "ABSENT_NO_AUTO_ACTION" });

    const second = await new ResolveRoundV2UseCase(fx, () => T(20)).execute({ roundId: "round2" });
    expect(second).toEqual({ status: "RESOLVED", roundNo: 2, completed: true });
    const c2 = fx.commits[1] as CommitRoundResolutionInput;
    expect(c2.completion?.result.winners.length).toBeGreaterThanOrEqual(0);
    expect(c2.events.map((e) => e.eventType)).toEqual(["round.resolved", "game.completed"]);

    // Replay of everything stored must reproduce the committed final state hash.
    const replayed = gameV2.createGameEngineV2().replay({
      init: {
        config,
        participants: seats.map((s) => ({
          participantId: s.participationId,
          entrySequence: s.entrySequence as number,
          positions: s.positions,
          movementBalance: s.movementAllowance,
          autoAction: "NONE" as const,
        })),
        randomnessCommitmentHash: fx.initialSorte.randomnessCommitmentHash,
        initialSortePosition: fx.initialSorte.initialLuckPosition,
      },
      steps: [...fx.priorSteps, (c2.completion as NonNullable<typeof c2.completion>).step],
    });
    expect(replayed.result?.finalStateHash).toBe(c2.completion?.result.finalStateHash);
  });

  it("is a no-op for an already resolved round (idempotent)", async () => {
    const fx = new ResolutionFixture();
    const useCase = new ResolveRoundV2UseCase(fx, () => T(10));
    await useCase.execute({ roundId: "round1" });
    expect(await useCase.execute({ roundId: "round1" })).toEqual({ status: "NOOP" });
    expect(fx.commits).toHaveLength(1);
  });
});
