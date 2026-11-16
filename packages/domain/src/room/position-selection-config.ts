/**
 * Position-selection settings of a room (DECISION-23/36/37). The time each participant has to
 * choose is configured per room/campaign by the operator; there is NO global default, and the
 * numbers in the product examples (30s, 60s, 2min, 5min) are examples, never constants. The
 * warning thresholds are UX parameters, not business rules.
 */
export interface PositionSelectionRoomConfig {
  /** DECISION-23: seconds each participant has once their turn opens (server clock). */
  readonly selectionWindowSeconds: number;
  /** DECISION-25: remaining-seconds marks at which the participant is warned (UX). */
  readonly warningThresholdSeconds?: readonly number[];
  /** DECISION-35: "N participants ahead of you" marks at which the participant is warned (UX). */
  readonly upcomingTurnThresholds?: readonly number[];
  /** DECISION-27: a missed window is always resolved by the server; never false. */
  readonly autoAssignOnTimeout: true;
}

export class InvalidPositionSelectionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPositionSelectionConfigError";
  }
}

function assertPositiveUniqueIntegers(values: readonly number[], field: string): void {
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 1 || seen.has(value)) {
      throw new InvalidPositionSelectionConfigError(
        `${field} deve conter inteiros positivos sem repetição.`,
      );
    }
    seen.add(value);
  }
}

export function assertValidPositionSelectionConfig(config: PositionSelectionRoomConfig): void {
  if (!Number.isSafeInteger(config.selectionWindowSeconds) || config.selectionWindowSeconds < 1) {
    throw new InvalidPositionSelectionConfigError(
      "O tempo de escolha das posições deve ser um número inteiro de segundos maior que zero.",
    );
  }
  if ((config.autoAssignOnTimeout as boolean) !== true) {
    throw new InvalidPositionSelectionConfigError(
      "A escolha automática ao fim do tempo é obrigatória.",
    );
  }
  const warnings = config.warningThresholdSeconds ?? [];
  assertPositiveUniqueIntegers(warnings, "Os avisos de tempo");
  if (warnings.some((seconds) => seconds >= config.selectionWindowSeconds)) {
    throw new InvalidPositionSelectionConfigError(
      "Cada aviso de tempo deve ser menor que o tempo total de escolha.",
    );
  }
  assertPositiveUniqueIntegers(config.upcomingTurnThresholds ?? [], "Os avisos de vez próxima");
}
