import {
  isInFinalPhase,
  lockFinalMovementPlan,
  type MovementCommand,
  type Participation,
} from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { RoomRepository } from "../../ports/room-repository.port.js";
import { ConflictError, NotFoundError, ValidationError } from "../../errors.js";

export interface SubmitFinalMovementCommandInput {
  participationId: string;
  commands: readonly MovementCommand[];
  atSequence: number;
}

/**
 * TASK-030 Final Movement Plan / FR-039 Final Lock / BR-028 (immutable
 * once locked). Once a room is in FINAL_LOCK, a participant may lock
 * their final plan exactly once — @passasorte/domain's
 * lockFinalMovementPlan throws FinalMovementPlanAlreadyLockedError on a
 * second attempt, which this use case surfaces as a 409 Conflict.
 * Participants who never call this are handled later, at resolution
 * time, by the room's MissingFinalSubmissionPolicy (BR-029) — this use
 * case does not invent behavior for that case itself.
 */
export class SubmitFinalMovementCommandUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly participationRepository: ParticipationRepository,
  ) {}

  async execute(input: SubmitFinalMovementCommandInput): Promise<Participation> {
    const participation = await this.participationRepository.findById(input.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", input.participationId);
    }

    const room = await this.roomRepository.findById(participation.roomId);
    if (!room) {
      throw new NotFoundError("GameRoom", participation.roomId);
    }
    if (room.status !== "FINAL_LOCK") {
      throw new ValidationError("A sala não está na fase de bloqueio final.", {
        field: "roomId",
      });
    }
    if (!isInFinalPhase(input.atSequence, room.gameConfig.finalLock)) {
      throw new ValidationError("O sequencial informado é anterior ao início da fase final.", {
        field: "atSequence",
      });
    }

    const existing = await this.participationRepository.findFinalMovementPlan(participation.id);
    if (existing) {
      throw new ConflictError("O plano final desta participação já está travado.");
    }

    const plan = lockFinalMovementPlan(
      undefined,
      participation.id,
      input.commands,
      input.atSequence,
    );

    return this.participationRepository.lockFinalMovementPlan(participation.id, plan);
  }
}
