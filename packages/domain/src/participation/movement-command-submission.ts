/**
 * Movement command submission validation (FR-037 Movement Validation).
 * Pure, structural checks only: that the command targets one of the
 * participation's own held positions, and that the participation is in
 * a status where movement is legal. Idempotent submission (FR-038) is
 * an infrastructure/application concern (a dedupe store keyed by an
 * idempotency key) and is not modeled here.
 */
import type { MovementCommand } from "../game/movement.js";
import type { Participation } from "./participation.entity.js";

export class InvalidMovementSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMovementSubmissionError";
  }
}

/** FR-037: throws unless the command targets a position this participation actually owns and the participation is ACTIVE. */
export function assertValidMovementSubmission(
  participation: Participation,
  command: MovementCommand,
): void {
  if (participation.status !== "ACTIVE") {
    throw new InvalidMovementSubmissionError(
      `A participação "${participation.id}" não está ativa para submeter movimentos.`,
    );
  }
  if (command.positionIndex < 0 || command.positionIndex >= participation.positions.length) {
    throw new InvalidMovementSubmissionError(
      `A posição de índice ${command.positionIndex} não pertence à participação "${participation.id}".`,
    );
  }
}
