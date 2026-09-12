import {
  assertValidMovementSubmission,
  spendMovement,
  toMovementAllocation,
  type MovementCommand,
  type Participation,
} from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { IdempotencyPort } from "../../ports/idempotency.port.js";
import { NOOP_OUTBOX_PORT, type OutboxPort } from "../../ports/outbox.port.js";
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
 * even if the same request arrives twice. It also appends the command to
 * the room's replayable movement log (BR-026/FR-044) so Phase 5's
 * AdvanceRoomOperationsUseCase can later feed it to the GameEngine as one
 * of that room's "rounds".
 */
export class SubmitMovementCommandUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly idempotency: IdempotencyPort,
    private readonly outbox: OutboxPort = NOOP_OUTBOX_PORT,
  ) {}

  async execute(input: SubmitMovementCommandInput): Promise<SubmitMovementCommandResult> {
    const participation = await this.participationRepository.findById(input.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", input.participationId);
    }

    try {
      assertValidMovementSubmission(participation, input.command);
    } catch (error) {
      await this.outbox.publish({
        aggregateType: "Participation",
        aggregateId: participation.id,
        eventType: "movement.rejected",
        payload: {
          userId: participation.userId,
          participationId: participation.id,
          reason: error instanceof Error ? error.message : "unknown",
        },
      });
      throw error;
    }

    const isFirstSubmission = await this.idempotency.record(input.idempotencyKey);
    if (!isFirstSubmission) {
      throw new ConflictError("Este movimento já foi submetido anteriormente.");
    }

    await this.participationRepository.appendMovementCommand(participation.roomId, input.command);

    const newAllocation = spendMovement(toMovementAllocation(participation));
    const updated = await this.participationRepository.updateMovementAllocation(
      participation.id,
      newAllocation,
    );

    await this.outbox.publish({
      aggregateType: "Participation",
      aggregateId: participation.id,
      eventType: "movement.accepted",
      payload: {
        userId: participation.userId,
        participationId: participation.id,
        direction: input.command.direction,
        sequence: input.command.sequence,
      },
    });

    return { participation: updated };
  }
}
