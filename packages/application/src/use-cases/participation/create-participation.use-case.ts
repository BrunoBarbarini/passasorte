import {
  evaluateEligibility,
  type Participation,
  type ParticipationPackage,
  type Position,
} from "@passasorte/domain";
import type { ParticipationRepository } from "../../ports/participation-repository.port.js";
import { NOOP_OUTBOX_PORT, type OutboxPort } from "../../ports/outbox.port.js";
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
 *
 * A freshly created participation is immediately advanced from CREATED
 * through RESERVED to AWAITING_REQUIREMENT: there is currently no
 * external requirement gate to wait on (payment is a LEGAL GATE behind
 * ENABLE_PAID_PARTICIPATION, off by default — CLAUDE.md #1.9/#22), so
 * nothing would ever move it there otherwise. This is a mechanical state
 * transition, not an invented business rule about what those states mean;
 * once a real requirement (e.g. payment) exists, gating this transition
 * on it is Phase 6's job, not something to guess at here.
 */
export class CreateParticipationUseCase {
  constructor(
    private readonly participationRepository: ParticipationRepository,
    private readonly outbox: OutboxPort = NOOP_OUTBOX_PORT,
  ) {}

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

    const created = await this.participationRepository.create({
      roomId: command.roomId,
      userId: command.userId,
      packageId: command.package.id,
      positions: command.positions,
      movementAllowance: command.package.movementAllowance,
    });
    await this.participationRepository.transition(created.id, "RESERVED");
    const result = await this.participationRepository.transition(
      created.id,
      "AWAITING_REQUIREMENT",
    );

    await this.outbox.publish({
      aggregateType: "Participation",
      aggregateId: created.id,
      eventType: "participation.started",
      payload: { userId: command.userId, roomId: command.roomId, participationId: created.id },
    });

    return result;
  }
}
