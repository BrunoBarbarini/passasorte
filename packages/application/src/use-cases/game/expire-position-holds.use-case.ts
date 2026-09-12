import type { PositionHold } from "@passasorte/domain";
import type { PositionHoldRepository } from "../../ports/position-hold-repository.port.js";

export interface ExpirePositionHoldsCommand {
  now?: Date;
}

/**
 * TASK-034 Scheduler. BR-010/FR-022..FR-026: an ACTIVE hold whose TTL
 * elapsed must stop blocking that position — this is a fully decided
 * mechanic (holdTtlMs/expiresAt already exist per room), unlike the
 * game-progression side of Phase 5, so it needs no pluggable seam.
 */
export class ExpirePositionHoldsUseCase {
  constructor(private readonly holdRepository: PositionHoldRepository) {}

  async execute(command: ExpirePositionHoldsCommand = {}): Promise<readonly PositionHold[]> {
    return this.holdRepository.expireOverdue(command.now ?? new Date());
  }
}
