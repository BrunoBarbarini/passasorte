/**
 * Movement (BR-020..BR-023/FR-035..FR-038). MVP directions are LEFT/
 * RIGHT (BR-021, FACT). The exact EFFECT of a movement on the board is
 * explicitly TBD (BR-022, ADR-018) and CLAUDE.md #58 forbids inventing
 * it - this module only defines the pluggable seam plus a
 * clearly-labeled simulation-only strategy (BR-023's
 * PLAYER_TRANSLATION_V1, sanctioned for simulation/prototyping only).
 */
import type { BoardConfig, Position } from "./board.js";

export type MovementDirection = "LEFT" | "RIGHT"; // BR-021

export interface MovementCommand {
  readonly participationId: string;
  /** Which of the participant's held positions (BR-007/BR-008) this command applies to. */
  readonly positionIndex: number;
  readonly direction: MovementDirection;
  readonly sequence: number; // BR-026: game steps are sequence-numbered
}

/** Finite, non-negative movement budget (BR-020). */
export class InvalidMovementAllowanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMovementAllowanceError";
  }
}

export function assertValidMovementAllowance(allowance: number): void {
  if (!Number.isInteger(allowance) || allowance < 0) {
    throw new InvalidMovementAllowanceError(
      "O saldo de movimentos deve ser um inteiro maior ou igual a zero.",
    );
  }
}

/** Throws when there is no remaining budget to spend a movement (BR-020). */
export function assertMovementAllowed(remainingAllowance: number): void {
  if (remainingAllowance <= 0) {
    throw new InvalidMovementAllowanceError("Não há mais movimentos disponíveis.");
  }
}

export interface MovementResolutionStrategy {
  readonly id: string;
  /** Resolves a participant's next position given their current position and a movement command. */
  resolve(input: {
    readonly currentPosition: Position;
    readonly command: MovementCommand;
    readonly board: BoardConfig;
  }): Position;
}

/**
 * SIMULATION-ONLY (BR-023). NOT a product decision - CLAUDE.md #58
 * forbids treating "movement effect" as decided. Translates the targeted
 * position by one board unit in the command's direction, clamped to the
 * board bounds. Exists only to give the Phase 2 engine prototype a
 * concrete, reproducible strategy for tests/replay fixtures.
 */
export const SIMULATION_ONLY_PLAYER_TRANSLATION_V1: MovementResolutionStrategy = {
  id: "PLAYER_TRANSLATION_V1",
  resolve({ currentPosition, command, board }) {
    const delta = command.direction === "LEFT" ? -1 : 1;
    const next = currentPosition + delta;
    return Math.min(Math.max(next, 0), board.size - 1);
  },
};
