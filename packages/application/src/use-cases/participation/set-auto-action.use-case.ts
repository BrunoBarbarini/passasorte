import type { gameV2, Participation } from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import { DomainError, NotFoundError } from "../../errors.js";

/** Statuses before the participation starts playing. Once ACTIVE the engine state is frozen. */
const EDITABLE_STATUSES = new Set(["CREATED", "RESERVED", "AWAITING_REQUIREMENT", "CONFIRMED"]);

/**
 * DECISION-03/04: the participant chooses what happens when they are absent in a round.
 * ASSUMPTION (CLAUDE.md): it can be changed until the room starts; at start it is frozen
 * into the engine seats so replay stays deterministic. A different rule needs a decision.
 */
export class SetAutoActionUseCase {
  constructor(private readonly participations: ParticipationRepository) {}

  async execute(input: {
    readonly participationId: string;
    readonly autoAction: gameV2.AutoAction;
  }): Promise<Participation> {
    const participation = await this.participations.findById(input.participationId);
    if (!participation) throw new NotFoundError("Participation", input.participationId);
    if (!EDITABLE_STATUSES.has(participation.status)) {
      throw new DomainError(
        "A ação automática só pode ser alterada antes de a sala começar a jogar.",
      );
    }
    return this.participations.setAutoAction(participation.id, input.autoAction);
  }
}
