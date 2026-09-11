import { assertParticipationTransition, type Participation } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface ConfirmParticipationCommand {
  participationId: string;
}

/**
 * FR-026 Position Commitment / FR-030 Participation Confirmation: moves
 * a participation to CONFIRMED only once every condition is complete.
 * This use case validates the transition is legal per the state
 * machine; it does not decide what "all conditions complete" means
 * beyond that (payment, eligibility, etc. are each their own concern,
 * wired in by the caller before this runs).
 */
export class ConfirmParticipationUseCase {
  constructor(private readonly participationRepository: ParticipationRepository) {}

  async execute(command: ConfirmParticipationCommand): Promise<Participation> {
    const participation = await this.participationRepository.findById(command.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", command.participationId);
    }

    assertParticipationTransition(participation.status, "CONFIRMED");

    return this.participationRepository.transition(command.participationId, "CONFIRMED");
  }
}
