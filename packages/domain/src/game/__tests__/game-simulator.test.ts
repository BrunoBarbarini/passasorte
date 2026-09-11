import { describe, expect, it } from "vitest";
import { createGameEngineSimulationV1 } from "../game-engine.js";
import { simulateAndVerifyReplay, type GameSimulationScript } from "../game-simulator.js";
import { generateRandomSeed } from "../randomness-commitment.js";
import type { GameConfigSnapshot } from "../game-config.js";

function buildScript(): GameSimulationScript {
  const config: GameConfigSnapshot = {
    engineVersion: "SIMULATION_V1",
    board: { size: 15 },
    initialSorteZone: { start: 6, end: 8 },
    temperatureBands: [
      { name: "QUENTE", maxNormalizedDistance: 0.2 },
      { name: "FRIO", maxNormalizedDistance: 1 },
    ],
    movementAllowancePerParticipation: 2,
    finalLock: { finalPhaseStartSequence: 2 },
  };
  return {
    config,
    initialPositions: [
      { participationId: "p1", positions: [0] },
      { participationId: "p2", positions: [14] },
    ],
    seed: generateRandomSeed(),
    rounds: [
      [{ participationId: "p1", positionIndex: 0, direction: "RIGHT", sequence: 1 }],
      [{ participationId: "p2", positionIndex: 0, direction: "LEFT", sequence: 2 }],
    ],
  };
}

describe("simulateAndVerifyReplay (FR-044 Game Replay for Audit)", () => {
  it("runs the script and returns a result that replays identically from the same commitment", () => {
    const engine = createGameEngineSimulationV1();
    const script = buildScript();

    const result = simulateAndVerifyReplay(engine, script);

    expect(result.steps).toHaveLength(2);
    expect(result.engineVersion).toBe(engine.version);
  });

  it("is deterministic across independently constructed scripts with the same seed", () => {
    const engine = createGameEngineSimulationV1();
    const script = buildScript();

    const first = simulateAndVerifyReplay(engine, script);
    const second = simulateAndVerifyReplay(engine, { ...script });

    expect(first.finalSorteZone).toEqual(second.finalSorteZone);
    expect(first.winners).toEqual(second.winners);
  });
});
