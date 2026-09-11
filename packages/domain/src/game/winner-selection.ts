/**
 * Winner selection (BR-032/BR-033, FR-042/FR-043, ADR-019). Winner
 * semantics - what exactly determines a winner, multi-winner behavior,
 * empty-zone behavior - are explicitly TBD (CLAUDE.md #56 Product -
 * CRITICAL) and CLAUDE.md #58 forbids inventing "winner rule/count/
 * ties". `Winner[]` must support zero, one or many entries without a
 * shape change (ADR-019) - this module only defines that generic seam
 * plus a labeled simulation-only strategy for Phase 2 tests/fixtures.
 */
import type { Position } from "./board.js";
import type { SorteZone } from "./sorte.js";

export interface FinalParticipantState {
  readonly participationId: string;
  readonly finalPositions: readonly Position[];
}

export interface Winner {
  readonly participationId: string;
  readonly winningPosition: Position;
}

export interface WinnerSelectionStrategy {
  readonly id: string;
  /** Returns zero, one or many winners (ADR-019) - callers must never assume a fixed cardinality. */
  selectWinners(input: {
    readonly finalStates: readonly FinalParticipantState[];
    readonly sorteZone: SorteZone;
  }): readonly Winner[];
}

/**
 * SIMULATION-ONLY (BR-033 is explicitly TBD - CLAUDE.md #58 forbids
 * shipping any "first closest wins" style default as if confirmed).
 * Every final position that landed exactly inside the Sorte zone is
 * reported as a winner - naturally zero, one or many. This is only a
 * geometrically neutral placeholder so the Phase 2 engine prototype has
 * a concrete, testable strategy; it must not be wired in as the real
 * product rule without an explicit decision.
 */
export const SIMULATION_ONLY_INSIDE_ZONE_V1: WinnerSelectionStrategy = {
  id: "SIMULATION_ONLY_INSIDE_ZONE_V1",
  selectWinners({ finalStates, sorteZone }) {
    const winners: Winner[] = [];
    for (const state of finalStates) {
      for (const position of state.finalPositions) {
        if (position >= sorteZone.start && position <= sorteZone.end) {
          winners.push({ participationId: state.participationId, winningPosition: position });
        }
      }
    }
    return winners;
  },
};
