import { assertParticipationTransition, type Participation } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import type { PositionHoldRepository } from "../../ports/position-hold-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface ConfirmParticipationCommand {
  participationId: string;
}

/**
 * FR-026 Position Commitment / FR-030 Participation Confirmation: moves
 * a participation to CONFIRMED only once every condition is complete,
 * and converts every position hold it depends on from a TTL-bound ACTIVE
 * hold into a permanent COMMITTED one (FR-026) so it can no longer expire
 * out from under a confirmed participant. This use case validates the
 * transition is legal per the state machine; it does not decide what
 * "all conditions complete" means beyond that (payment, eligibility,
 * etc. are each their own concern, wired in by the caller before this
 * runs).
 */
export class ConfirmParticipationUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly holdRepository: PositionHoldRepository,
  ) {}

  async execute(command: ConfirmParticipationCommand): Promise<Participation> {
    const participation = await this.participationRepository.findById(command.participationId);
    if (!participation) {
      throw new NotFoundError("Participation", command.participationId);
    }

    assertParticipationTransition(participation.status, "CONFIRMED");

    for (const { position } of participation.positions) {
      await this.holdRepository.commitHold(participation.roomId, position);
    }

    return this.participationRepository.transition(command.participationId, "CONFIRMED");
  }
}
