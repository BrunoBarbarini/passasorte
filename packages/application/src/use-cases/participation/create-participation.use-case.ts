import {
  evaluateEligibility,
  type Participation,
  type ParticipationPackage,
  type Position,
} from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import { ValidationError } from "../../errors.js";

export interface CreateParticipationCommand {
  roomId: string;
  userId: string;
  package: ParticipationPackage;
  positions: readonly Position[];
}

/**
 * FR-027 Participation Creation + FR-028 Eligibility Validation
 * (server-side). Eligibility RULES themselves come from the package
 * (CLAUDE.md #58 forbids inventing what those rules are) — this use
 * case only enforces that whatever is configured actually runs before a
 * participation is created.
 */
export class CreateParticipationUseCase {
  constructor(private readonly participationRepository: ParticipationRepository) {}

  async execute(command: CreateParticipationCommand): Promise<Participation> {
    if (command.positions.length !== command.package.positionCount) {
      throw new ValidationError(
        `Este pacote exige exatamente ${command.package.positionCount} posição(ões).`,
        { field: "positions" },
      );
    }

    const existingActiveParticipationCount =
      await this.participationRepository.countActiveByUserAndRoom(command.userId, command.roomId);

    const violations = evaluateEligibility(command.package.eligibilityRules, {
      userId: command.userId,
      roomId: command.roomId,
      requestedPositionCount: command.positions.length,
      existingActiveParticipationCount,
    });
    if (violations.length > 0) {
      throw new ValidationError(violations.map((v) => v.message).join(" "), {
        violations: violations.map((v) => v.ruleId),
      });
    }

    return this.participationRepository.create({
      roomId: command.roomId,
      userId: command.userId,
      packageId: command.package.id,
      positions: command.positions,
    });
  }
}
