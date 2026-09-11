/**
 * Participation package (FR-029): the configurable bundle a participant
 * enters with — how many positions, how many movements, and (optionally,
 * since paid participation is a LEGAL GATE per BR-034) a price. No field
 * has a hard-coded default; every value is caller-supplied configuration.
 */
import type { EligibilityRule } from "./eligibility.js";

export interface ParticipationPackage {
  readonly id: string;
  readonly positionCount: number;
  readonly movementAllowance: number;
  readonly eligibilityRules: readonly EligibilityRule[];
  /** Present only once a price model exists (BR-034/BR-042/CLAUDE.md #56 revenue model is TBD) — absent means free/unpriced. */
  readonly priceMinorUnits?: number;
}

export class InvalidParticipationPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParticipationPackageError";
  }
}

export function assertValidParticipationPackage(pkg: ParticipationPackage): void {
  if (!Number.isInteger(pkg.positionCount) || pkg.positionCount <= 0) {
    throw new InvalidParticipationPackageError(
      "O número de posições do pacote deve ser um inteiro positivo.",
    );
  }
  if (!Number.isInteger(pkg.movementAllowance) || pkg.movementAllowance < 0) {
    throw new InvalidParticipationPackageError(
      "O saldo de movimentos do pacote deve ser um inteiro maior ou igual a zero.",
    );
  }
  if (
    pkg.priceMinorUnits !== undefined &&
    (!Number.isInteger(pkg.priceMinorUnits) || pkg.priceMinorUnits < 0)
  ) {
    // BR-035: money uses integer minor units.
    throw new InvalidParticipationPackageError(
      "O preço do pacote deve ser um inteiro em unidades monetárias mínimas (ex.: centavos).",
    );
  }
}
