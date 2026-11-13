// DEPRECATED (ADR-022/023/024, 2026-11-12): legacy client-sequenced movement commands; V2 uses collective round windows (DECISION-16).
// Do not extend. Replaced by `gameV2` (packages/domain/src/game/v2). Removed in the
// contract step of docs/LEGACY_AUDIT_ENGINE_V2.md once no legacy room is active.
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
