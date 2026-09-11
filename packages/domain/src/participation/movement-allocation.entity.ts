/**
 * Movement allocation (BR-020, FR-029/FR-035). Tracks how much of a
 * participation's movement budget has been spent. The budget itself
 * comes from the participation's package (this module does not decide
 * its size); it only enforces that spend never goes negative.
 */
export interface MovementAllocation {
  readonly participationId: string;
  readonly totalAllowance: number;
  readonly usedCount: number;
}

export class MovementAllocationExhaustedError extends Error {
  constructor(participationId: string) {
    super(`A participação "${participationId}" não possui mais movimentos disponíveis.`);
    this.name = "MovementAllocationExhaustedError";
  }
}

export function remainingMovementAllowance(allocation: MovementAllocation): number {
  return allocation.totalAllowance - allocation.usedCount;
}

/** Spends one movement, returning a new allocation. Throws if none remain (BR-020). */
export function spendMovement(allocation: MovementAllocation): MovementAllocation {
  if (remainingMovementAllowance(allocation) <= 0) {
    throw new MovementAllocationExhaustedError(allocation.participationId);
  }
  return { ...allocation, usedCount: allocation.usedCount + 1 };
}
