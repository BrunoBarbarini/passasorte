/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import { gameV2, type GameRoom, type Participation } from "@passasorte/domain";
import { GetParticipantGameStateUseCase } from "../use-cases/game/get-participant-game-state.use-case.js";
import type {
  ParticipantGameStatePort,
  RoomGameData,
} from "../ports/participant-game-state.port.js";
import type { ParticipationRepository } from "../ports/participation-repository.port.js";
import type { RoomRepository } from "../ports/room-repository.port.js";
import { NotFoundError } from "../errors.js";

const T0 = new Date("2026-11-14T12:00:00.000Z");
const at = (s: number) => new Date(T0.getTime() + s * 1000);

/** Bar of 100 positions; the Sorte starts on 50. a owns 51..52 (very close), b owns 10 (far). */
const data = (steps: RoomGameData["steps"] = []): RoomGameData => ({
  config: { winningZoneSize: 1, maxMovementsPerRound: 3 },
  initialSorte: {
    gameId: "g",
    boardSize: 100,
    engineVersion: gameV2.ENGINE_V2_VERSION,
    randomnessCommitmentHash: "h".repeat(64),
    initialLuckPosition: 50,
    generatedAt: T0.toISOString(),
  },
  seats: [
    {
      participationId: "a",
      entrySequence: 1,
      positions: [51, 52],
      movementAllowanceTotal: 4,
      autoAction: "NONE",
    },
    {
      participationId: "b",
      entrySequence: 2,
      positions: [10],
      movementAllowanceTotal: 4,
      autoAction: "LEFT",
    },
    {
      participationId: "filler",
      entrySequence: 3,
      positions: Array.from({ length: 100 }, (_, i) => i + 1).filter(
        (n) => n !== 51 && n !== 52 && n !== 10,
      ),
      movementAllowanceTotal: 1,
      autoAction: "NONE",
    },
  ],
  steps,
  rounds: [
    { roundNo: 1, windowOpensAt: at(0), windowClosesAt: at(60), resolved: false },
    { roundNo: 2, windowOpensAt: at(60), windowClosesAt: at(120), resolved: false },
  ],
});

function make(
  status: string,
  participationStatus = "ACTIVE",
  gameData: RoomGameData | null = data(),
) {
  const part = (id: string, used = 0) =>
    ({
      id,
      roomId: "room",
      userId: "u",
      packageId: "p",
      positions: (id === "a" ? [51, 52] : [10]).map((position) => ({
        participationId: id,
        position,
      })),
      status: participationStatus,
      movementAllowanceTotal: 4,
      movementAllowanceUsed: used,
      autoAction: id === "b" ? "LEFT" : "NONE",
      createdAt: T0,
    }) as unknown as Participation;
  const participations = {
    findById: async (id: string) => (id === "a" || id === "b" ? part(id) : null),
  } as unknown as ParticipationRepository;
  const rooms = {
    findById: async () => ({ id: "room", status }) as unknown as GameRoom,
  } as unknown as RoomRepository;
  const port: ParticipantGameStatePort = {
    loadRoomGameData: async () => gameData,
    loadLatestSubmission: async (_r, roundNo, id) =>
      id === "a" ? { kind: "RIGHT", credits: 2, roundNo } : null,
    loadFinalResult: async () => ({ winningPositions: [51] }),
  };
  return (clock: Date) =>
    new GetParticipantGameStateUseCase(participations, rooms, port, () => clock);
}

describe("GetParticipantGameStateUseCase", () => {
  it("shows only the temperature LEVEL, own balance, round window and own action", async () => {
    const view = await make("RUNNING")(at(10)).execute({ participationId: "a" });
    expect(view.temperature).toEqual({ level: "MUITO_QUENTE", label: "Muito quente" });
    expect(view.movements).toEqual({ total: 4, used: 0, remaining: 4 });
    expect(view.round).toMatchObject({ roundNo: 1, totalRounds: 2, phase: "OPEN" });
    expect(view.myAction).toEqual({ kind: "RIGHT", credits: 2 });
    expect(view.maxMovementsPerRound).toBe(3);
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/sorte|luck|distance|distância/i);
    expect(text).not.toContain("50");
  });

  it("is personalised: a far participant sees a colder level", async () => {
    const far = await make("RUNNING")(at(10)).execute({ participationId: "b" });
    expect(far.temperature?.level).toBe("CONGELANDO");
    expect(far.myAction).toBeNull();
  });

  it("derives the round phase from the server clock", async () => {
    const before = await make("RUNNING")(new Date(T0.getTime() - 5000)).execute({
      participationId: "a",
    });
    expect(before.round?.phase).toBe("UPCOMING");
    const late = await make("RUNNING")(at(70)).execute({ participationId: "a" });
    expect(late.round).toMatchObject({ roundNo: 1, phase: "RESOLVING" });
  });

  it("shows no temperature outside a running game", async () => {
    const view = await make(
      "POSITION_SELECTION",
      "CONFIRMED",
      null,
    )(at(1)).execute({ participationId: "a" });
    expect(view.temperature).toBeNull();
    expect(view.round).toBeNull();
    expect(view.result).toBeNull();
  });

  it("reveals the result only after completion", async () => {
    const won = await make("COMPLETED", "WON")(at(1)).execute({ participationId: "a" });
    expect(won.result).toEqual({ won: true, winningPositions: [51] });
    expect(won.temperature).toBeNull();
    const lost = await make("COMPLETED", "NOT_WON")(at(1)).execute({ participationId: "b" });
    expect(lost.result?.won).toBe(false);
  });

  it("rejects an unknown participation", async () => {
    await expect(make("RUNNING")(at(1)).execute({ participationId: "zzz" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
