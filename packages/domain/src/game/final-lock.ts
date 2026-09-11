/**
 * Final strategy lock (BR-026..BR-029/FR-039/FR-040). The round
 * THRESHOLD that starts the final phase is configurable (BR-027); once
 * locked, a participant's final movement plan is immutable (BR-028).
 * What happens when a participant never submits a final plan is
 * explicitly TBD (BR-029) - CLAUDE.md #58 forbids inventing that
 * behavior, so this module only defines the pluggable seam plus a
 * labeled simulation-only default.
 */
import type { MovementCommand } from "./movement.js";

export interface FinalLockConfig {
  /** Sequence number at/after which the game is in its final phase (BR-027). */
  readonly finalPhaseStartSequence: number;
}

export interface FinalMovementPlan {
  readonly participationId: string;
  readonly commands: readonly MovementCommand[];
  readonly lockedAtSequence: number;
  readonly immutable: true; // BR-028
}

export class FinalMovementPlanAlreadyLockedError extends Error {
  constructor(participationId: string) {
    super(`O plano final da participação "${participationId}" já está travado e é imutável.`);
    this.name = "FinalMovementPlanAlreadyLockedError";
  }
}

/** Locks a participant's final plan. Throws if one is already locked (BR-028: immutable once accepted). */
export function lockFinalMovementPlan(
  existing: FinalMovementPlan | undefined,
  participationId: string,
  commands: readonly MovementCommand[],
  atSequence: number,
): FinalMovementPlan {
  if (existing) {
    throw new FinalMovementPlanAlreadyLockedError(participationId);
  }
  return { participationId, commands, lockedAtSequence: atSequence, immutable: true };
}

export function isInFinalPhase(currentSequence: number, config: FinalLockConfig): boolean {
  return currentSequence >= config.finalPhaseStartSequence;
}

export interface MissingFinalSubmissionPolicy {
  readonly id: string;
  /** Produces the effective plan to use for a participant who never locked one (BR-029). */
  resolveMissingPlan(input: {
    readonly participationId: string;
    readonly lastKnownCommands: readonly MovementCommand[];
    readonly atSequence: number;
  }): FinalMovementPlan;
}

/**
 * SIMULATION-ONLY (BR-029 is explicitly TBD). Treats a missing
 * submission as "keep whatever was already submitted, spend no further
 * movements" - a neutral placeholder for the prototype/replay fixtures
 * only, never the shipped behavior.
 */
export const SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1: MissingFinalSubmissionPolicy = {
  id: "SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1",
  resolveMissingPlan({ participationId, lastKnownCommands, atSequence }) {
    return {
      participationId,
      commands: lastKnownCommands,
      lockedAtSequence: atSequence,
      immutable: true,
    };
  },
};
