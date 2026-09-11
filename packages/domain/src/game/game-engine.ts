/**
 * GameEngine (ADR-011): the authoritative, versioned, pure actor for
 * Sorte/temperature/movement/result (CLAUDE.md #3.10, FR-031..FR-044).
 * No I/O (NFR-017) - callers pass every input explicitly and persist
 * whatever they need from the output themselves.
 *
 * `createGameEngineSimulationV1` is the Phase 2 "Game Domain Simulator"
 * deliverable (CLAUDE.md #53): it wires the pluggable strategies from
 * movement.ts/sorte-progression.ts/winner-selection.ts together so the
 * engine SHAPE (interface, versioning, replayability) exists and is
 * testable now, while movement effect, Sorte progression and winner
 * semantics stay exactly as undecided as CLAUDE.md marks them (BR-022,
 * BR-033, CLAUDE.md #58). Swapping in the real, decided strategies later
 * requires no engine rewrite (ADR-011/ADR-018).
 */
import type { BoardConfig, Position } from "./board.js";
import type { SorteZone } from "./sorte.js";
import type { GameConfigSnapshot } from "./game-config.js";
import { assertValidGameConfigSnapshot } from "./game-config.js";
import type { MovementCommand, MovementResolutionStrategy } from "./movement.js";
import { SIMULATION_ONLY_PLAYER_TRANSLATION_V1 } from "./movement.js";
import type { SorteProgressionStrategy } from "./sorte-progression.js";
import { SIMULATION_ONLY_RANDOM_WALK_SORTE_PROGRESSION_V1 } from "./sorte-progression.js";
import { deriveRandomUnitInterval } from "./randomness-commitment.js";
import {
  classifyTemperature,
  minDistanceToSorteZone,
  normalizeDistance,
  type TemperatureBand,
} from "./temperature.js";
import type { FinalParticipantState, Winner, WinnerSelectionStrategy } from "./winner-selection.js";
import { SIMULATION_ONLY_INSIDE_ZONE_V1 } from "./winner-selection.js";

/** BR-007/BR-008: a participant may hold multiple, not necessarily contiguous, positions. */
export interface ParticipantEntryPositions {
  readonly participationId: string;
  readonly positions: readonly Position[];
}

export interface GameStep {
  readonly sequence: number; // BR-026
  readonly sorteZone: SorteZone;
  readonly participantPositions: readonly ParticipantEntryPositions[];
  /** BR-017: personalized per participant. */
  readonly temperatures: ReadonlyMap<string, TemperatureBand>;
}

export interface GameResult {
  readonly engineVersion: string;
  readonly finalSorteZone: SorteZone;
  readonly winners: readonly Winner[]; // 0..N, ADR-019
  readonly steps: readonly GameStep[]; // FR-044: replayable
}

export interface GameEngineStrategies {
  readonly movementResolution: MovementResolutionStrategy;
  readonly sorteProgression: SorteProgressionStrategy;
  readonly winnerSelection: WinnerSelectionStrategy;
}

export interface GameEngineRunInput {
  readonly config: GameConfigSnapshot;
  readonly initialPositions: readonly ParticipantEntryPositions[];
  /** The revealed randomness seed for this room/round (BR-030/BR-031). */
  readonly revealedSeed: string;
  /** Movement commands for every round, in sequence order. */
  readonly rounds: readonly (readonly MovementCommand[])[];
}

export interface GameEngine {
  readonly version: string;
  run(input: GameEngineRunInput): GameResult;
}

function computeTemperatures(
  participants: readonly ParticipantEntryPositions[],
  zone: SorteZone,
  board: BoardConfig,
  bands: readonly TemperatureBand[],
): ReadonlyMap<string, TemperatureBand> {
  const temperatures = new Map<string, TemperatureBand>();
  for (const participant of participants) {
    if (participant.positions.length === 0) continue;
    const distance = minDistanceToSorteZone(participant.positions, zone);
    const normalized = normalizeDistance(distance, board);
    temperatures.set(participant.participationId, classifyTemperature(normalized, bands));
  }
  return temperatures;
}

const DEFAULT_SIMULATION_STRATEGIES: GameEngineStrategies = {
  movementResolution: SIMULATION_ONLY_PLAYER_TRANSLATION_V1,
  sorteProgression: SIMULATION_ONLY_RANDOM_WALK_SORTE_PROGRESSION_V1,
  winnerSelection: SIMULATION_ONLY_INSIDE_ZONE_V1,
};

/**
 * Builds a Phase 2 simulation GameEngine. Strategies default to the
 * SIMULATION-ONLY placeholders documented in movement.ts/
 * sorte-progression.ts/winner-selection.ts; pass explicit strategies to
 * run with something else (e.g. a future decided ruleset) without
 * touching this module.
 */
export function createGameEngineSimulationV1(
  strategies: GameEngineStrategies = DEFAULT_SIMULATION_STRATEGIES,
): GameEngine {
  const version = "SIMULATION_V1";

  return {
    version,
    run({ config, initialPositions, revealedSeed, rounds }: GameEngineRunInput): GameResult {
      assertValidGameConfigSnapshot(config);

      let zone = config.initialSorteZone;
      const positionsByParticipant = new Map<string, Position[]>(
        initialPositions.map((p) => [p.participationId, [...p.positions]]),
      );
      const steps: GameStep[] = [];

      rounds.forEach((round, roundIndex) => {
        const sequence = roundIndex + 1;

        for (const command of round) {
          const current = positionsByParticipant.get(command.participationId);
          if (!current || command.positionIndex < 0 || command.positionIndex >= current.length) {
            continue;
          }
          const resolved = strategies.movementResolution.resolve({
            currentPosition: current[command.positionIndex]!,
            command,
            board: config.board,
          });
          current[command.positionIndex] = resolved;
        }

        const randomUnitInterval = deriveRandomUnitInterval(revealedSeed, sequence);
        zone = strategies.sorteProgression.nextZone({
          previousZone: zone,
          board: config.board,
          stepSequence: sequence,
          randomUnitInterval,
        });

        const participantPositions: ParticipantEntryPositions[] = Array.from(
          positionsByParticipant.entries(),
        ).map(([participationId, positions]) => ({ participationId, positions: [...positions] }));

        steps.push({
          sequence,
          sorteZone: zone,
          participantPositions,
          temperatures: computeTemperatures(
            participantPositions,
            zone,
            config.board,
            config.temperatureBands,
          ),
        });
      });

      const finalStates: FinalParticipantState[] = Array.from(
        positionsByParticipant.entries(),
      ).map(([participationId, positions]) => ({ participationId, finalPositions: positions }));

      const winners = strategies.winnerSelection.selectWinners({ finalStates, sorteZone: zone });

      return { engineVersion: version, finalSorteZone: zone, winners, steps };
    },
  };
}
