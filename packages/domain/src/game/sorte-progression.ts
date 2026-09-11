/**
 * How the Sorte zone evolves from one game step to the next is an
 * explicitly undecided product/algorithm question (CLAUDE.md #58: the
 * "Sorte algorithm" must never be invented as a shipped rule). This
 * module only defines the pluggable seam (ADR-011: the engine must
 * accept pluggable strategies) plus a clearly-labeled simulation-only
 * default, so the GameEngine prototype (Phase 2, CLAUDE.md #53) has
 * something deterministic to run against in tests/fixtures.
 */
import type { BoardConfig } from "./board.js";
import type { SorteZone } from "./sorte.js";

export interface SorteProgressionStrategy {
  readonly id: string;
  nextZone(input: {
    readonly previousZone: SorteZone;
    readonly board: BoardConfig;
    readonly stepSequence: number;
    /** Deterministic randomness for this step, derived from the committed/revealed seed (see randomness-commitment.ts). */
    readonly randomUnitInterval: number; // in [0, 1)
  }): SorteZone;
}

/**
 * SIMULATION-ONLY. NOT a product decision (CLAUDE.md #58 forbids
 * shipping a "Sorte algorithm" as if confirmed). Moves the zone by a
 * deterministic pseudo-random offset derived from `randomUnitInterval`,
 * clamped to stay on the board. Exists only so Phase 2 replay
 * fixtures/tests have a concrete, reproducible strategy to exercise -
 * never wire this in as if it were the shipped Sorte algorithm.
 */
export const SIMULATION_ONLY_RANDOM_WALK_SORTE_PROGRESSION_V1: SorteProgressionStrategy = {
  id: "SIMULATION_ONLY_RANDOM_WALK_V1",
  nextZone({ previousZone, board, randomUnitInterval }) {
    const width = previousZone.end - previousZone.start + 1;
    const maxStart = board.size - width;
    if (maxStart <= 0) {
      return { start: 0, end: board.size - 1 };
    }
    const step = Math.floor((randomUnitInterval * 2 - 1) * width); // +/- one zone width
    const nextStart = Math.min(Math.max(previousZone.start + step, 0), maxStart);
    return { start: nextStart, end: nextStart + width - 1 };
  },
};
