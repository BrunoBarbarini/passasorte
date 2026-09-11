/**
 * Game Simulator (CLAUDE.md #53 Phase 2: "deterministic prototype ...
 * replay fixtures"). Given a scripted run (config + initial positions +
 * a revealed seed + rounds of movement commands), runs the engine twice
 * from the same commitment/reveal and asserts both runs match exactly -
 * proving the engine is replayable from a stored commitment alone
 * (FR-044 Game Replay for Audit).
 */
import type { GameEngine, GameResult, ParticipantEntryPositions } from "./game-engine.js";
import type { MovementCommand } from "./movement.js";
import type { GameConfigSnapshot } from "./game-config.js";
import { commitRandomSeed, verifyRevealedSeed } from "./randomness-commitment.js";

export interface GameSimulationScript {
  readonly config: GameConfigSnapshot;
  readonly initialPositions: readonly ParticipantEntryPositions[];
  /** The revealed seed for this simulation run (see randomness-commitment.ts). */
  readonly seed: string;
  readonly rounds: readonly (readonly MovementCommand[])[];
}

export class SimulationReplayMismatchError extends Error {
  constructor() {
    super("A reexecução determinística do simulador produziu um resultado diferente do original.");
    this.name = "SimulationReplayMismatchError";
  }
}

function serializeResult(result: GameResult): unknown {
  return {
    ...result,
    steps: result.steps.map((step) => ({
      ...step,
      temperatures: Array.from(step.temperatures.entries()),
    })),
  };
}

/**
 * Runs the script once, commits+verifies its seed, then replays it and
 * asserts the two runs are identical (FR-044). Returns the (single,
 * verified-replayable) GameResult.
 */
export function simulateAndVerifyReplay(
  engine: GameEngine,
  script: GameSimulationScript,
): GameResult {
  const commitment = commitRandomSeed(script.seed);
  verifyRevealedSeed(script.seed, commitment);

  const run = (): GameResult =>
    engine.run({
      config: script.config,
      initialPositions: script.initialPositions,
      revealedSeed: script.seed,
      rounds: script.rounds,
    });

  const first = run();
  const replay = run();

  if (JSON.stringify(serializeResult(first)) !== JSON.stringify(serializeResult(replay))) {
    throw new SimulationReplayMismatchError();
  }

  return first;
}
