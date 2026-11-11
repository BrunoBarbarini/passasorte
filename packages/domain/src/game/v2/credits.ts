/**
 * Single credit unit (DECISION-02, BR-061/062): 1 credit = 1 position OR
 * 1 movement. `creditQuantity` (a count) is deliberately separate from the
 * monetary value of a credit (`creditUnitPrice`, integer minor units, per
 * campaign). Nothing here knows a price or a limit: both come from the
 * campaign configuration. The atomic DB-level enforcement of the limit
 * (TASK-094) must still exist; these are the pure rules.
 */
import { GameEngineError } from "./errors.js";

export interface CreditSplit {
  readonly positions: number;
  readonly movements: number;
  readonly total: number;
}

/** Positions + movements, both non-negative integers, at least one credit overall. */
export function validateCreditSplit(input: { positions: number; movements: number }): CreditSplit {
  const { positions, movements } = input;
  if (
    !Number.isSafeInteger(positions) ||
    !Number.isSafeInteger(movements) ||
    positions < 0 ||
    movements < 0 ||
    positions + movements < 1
  ) {
    throw new GameEngineError(
      "INVALID_CREDIT_SPLIT",
      "A divisão de créditos deve usar números inteiros e pelo menos 1 crédito.",
    );
  }
  return { positions, movements, total: positions + movements };
}

/**
 * Cumulative per-campaign limit (DECISION-05): an over-limit purchase is
 * rejected in full - never accepted and corrected later. Returns the new total.
 */
export function assertWithinCreditLimit(input: {
  alreadyHeld: number;
  requested: number;
  maxCreditsPerParticipant: number;
}): number {
  const { alreadyHeld, requested, maxCreditsPerParticipant } = input;
  if (
    !Number.isSafeInteger(alreadyHeld) ||
    !Number.isSafeInteger(requested) ||
    !Number.isSafeInteger(maxCreditsPerParticipant) ||
    alreadyHeld < 0 ||
    requested < 1 ||
    maxCreditsPerParticipant < 1
  ) {
    throw new GameEngineError("INVALID_CREDIT_SPLIT", "Quantidades de créditos inválidas.");
  }
  if (alreadyHeld + requested > maxCreditsPerParticipant) {
    throw new GameEngineError(
      "CREDIT_LIMIT_EXCEEDED",
      `O limite desta campanha é de ${maxCreditsPerParticipant} créditos por participante; você já possui ${alreadyHeld} e tentou adquirir mais ${requested}.`,
    );
  }
  return alreadyHeld + requested;
}

/** Price in integer minor units (BR-035): never floating point. */
export function priceOfCredits(creditQuantity: number, creditUnitPriceMinor: number): number {
  const total = creditQuantity * creditUnitPriceMinor;
  if (
    !Number.isSafeInteger(creditQuantity) ||
    !Number.isSafeInteger(creditUnitPriceMinor) ||
    creditQuantity < 0 ||
    creditUnitPriceMinor < 0 ||
    !Number.isSafeInteger(total)
  ) {
    throw new GameEngineError("INVALID_CREDIT_SPLIT", "Valores de crédito inválidos.");
  }
  return total;
}
