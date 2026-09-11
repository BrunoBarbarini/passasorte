import {
  assertValidMovementSubmission,
  spendMovement,
  toMovementAllocation,
  type MovementCommand,
  type Participation,
} from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { IdempotencyPort } from "../../ports/idempotency.port.js";
import { ConflictError, NotFoundError } from "../../errors.js";

export interface SubmitMovementCommandInput {
  participationId: string;
  command: MovementCommand;
  /** Caller-supplied key so a retried/duplicated request is a no-op (FR-038). */
  idempotencyKey: string;
}

export interface SubmitMovementCommandResult {
  participation: Participation;
}

/**
 * FR-037 Movement Validation + FR-038 Idempotent Movement Submission.
 * What the movement DOES to the board (BR-022) is the GameEngine's
 * concern (Phase 2) — this use case only validates the submission is
 * legal and spends the participation's movement allowance exactly once,
 * even if the same request arrives twice.
 */
export class SubmitMovementCommandUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly idempotency: IdempotencyPort,
  ) {}

  async execute(input: SubmitMovementCommandInput): Promise<SubmitMovementCommandResult> {
    const participation = await this.participationRepository.findById(input.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", input.participationId);
    }

    assertValidMovementSubmission(participation, input.command);

    const isFirstSubmission = await this.idempotency.record(input.idempotencyKey);
    if (!isFirstSubmission) {
      throw new ConflictError("Este movimento já foi submetido anteriormente.");
    }

    const newAllocation = spendMovement(toMovementAllocation(participation));
    const updated = await this.participationRepository.updateMovementAllocation(
      participation.id,
      newAllocation,
    );
    return { participation: updated };
  }
}
