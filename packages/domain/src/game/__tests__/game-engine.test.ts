import { describe, expect, it } from "vitest";
import { createGameEngineSimulationV1 } from "../game-engine.js";
import type { GameConfigSnapshot } from "../game-config.js";
import { generateRandomSeed } from "../randomness-commitment.js";
import type { MovementCommand } from "../movement.js";

function buildConfig(overrides: Partial<GameConfigSnapshot> = {}): GameConfigSnapshot {
  return {
    engineVersion: "SIMULATION_V1",
    board: { size: 20 },
    initialSorteZone: { start: 9, end: 10 },
    temperatureBands: [
      { name: "QUENTE", maxNormalizedDistance: 0.1 },
      { name: "MORNO", maxNormalizedDistance: 0.5 },
      { name: "FRIO", maxNormalizedDistance: 1 },
    ],
    movementAllowancePerParticipation: 3,
    finalLock: { finalPhaseStartSequence: 3 },
    ...overrides,
  };
}

describe("createGameEngineSimulationV1", () => {
  it("is deterministic: same config + seed + rounds always produce the same result", () => {
    const engine = createGameEngineSimulationV1();
    const config = buildConfig();
    const seed = generateRandomSeed();
    const initialPositions = [
      { participationId: "p1", positions: [0] },
      { participationId: "p2", positions: [19] },
    ];
    const rounds: MovementCommand[][] = [
      [{ participationId: "p1", positionIndex: 0, direction: "RIGHT", sequence: 1 }],
      [{ participationId: "p2", positionIndex: 0, direction: "LEFT", sequence: 2 }],
    ];

    const first = engine.run({ config, initialPositions, revealedSeed: seed, rounds });
    const second = engine.run({ config, initialPositions, revealedSeed: seed, rounds });

    expect(first.finalSorteZone).toEqual(second.finalSorteZone);
    expect(first.winners).toEqual(second.winners);
    expect(first.steps.length).toBe(second.steps.length);
    expect(first.steps[0]?.sorteZone).toEqual(second.steps[0]?.sorteZone);
  });

  it("produces one step per round, sequence-numbered (BR-026)", () => {
    const engine = createGameEngineSimulationV1();
    const result = engine.run({
      config: buildConfig(),
      initialPositions: [{ participationId: "p1", positions: [0] }],
      revealedSeed: generateRandomSeed(),
      rounds: [[], [], []],
    });
    expect(result.steps.map((s) => s.sequence)).toEqual([1, 2, 3]);
  });

  it("moves a participant's targeted position via the movement strategy", () => {
    const engine = createGameEngineSimulationV1();
    const result = engine.run({
      config: buildConfig(),
      initialPositions: [{ participationId: "p1", positions: [5] }],
      revealedSeed: generateRandomSeed(),
      rounds: [[{ participationId: "p1", positionIndex: 0, direction: "RIGHT", sequence: 1 }]],
    });
    expect(result.steps[0]?.participantPositions[0]?.positions).toEqual([6]);
  });

  it("assigns a personalized temperature per participant (BR-017)", () => {
    const engine = createGameEngineSimulationV1();
    const config = buildConfig({ initialSorteZone: { start: 9, end: 10 } });
    const result = engine.run({
      config,
      initialPositions: [
        { participationId: "close", positions: [9] },
        { participationId: "far", positions: [19] },
      ],
      revealedSeed: generateRandomSeed(),
      rounds: [[]],
    });
    const temperatures = result.steps[0]?.temperatures;
    expect(temperatures?.get("close")?.name).toBe("QUENTE");
    expect(temperatures?.get("far")?.name).not.toBe("QUENTE");
  });

  it("rejects an invalid game config before running (CLAUDE.md #58: no hard-coded defaults)", () => {
    const engine = createGameEngineSimulationV1();
    expect(() =>
      engine.run({
        config: buildConfig({ board: { size: 0 } }),
        initialPositions: [],
        revealedSeed: generateRandomSeed(),
        rounds: [],
      }),
    ).toThrow();
  });
});
