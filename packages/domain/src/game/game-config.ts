/**
 * GameConfigSnapshot (BR-024/FR-032): the frozen, versioned
 * configuration a GameEngine instance runs against - immutable per
 * active room. Every dimension is caller-supplied (CLAUDE.md #58: board
 * size, quadrant count, etc. must never be hard-coded/assumed here).
 */
import type { BoardConfig } from "./board.js";
import { assertValidBoardConfig } from "./board.js";
import type { SorteZone } from "./sorte.js";
import { assertValidSorteZone } from "./sorte.js";
import type { TemperatureBand } from "./temperature.js";
import { assertValidTemperatureBands } from "./temperature.js";
import type { FinalLockConfig } from "./final-lock.js";

export interface GameConfigSnapshot {
  /** BR-024: immutable per active room. */
  readonly engineVersion: string;
  readonly board: BoardConfig;
  readonly initialSorteZone: SorteZone;
  readonly temperatureBands: readonly TemperatureBand[];
  /** BR-020: finite, non-negative. */
  readonly movementAllowancePerParticipation: number;
  readonly finalLock: FinalLockConfig;
}

export class InvalidGameConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameConfigError";
  }
}

export function assertValidGameConfigSnapshot(config: GameConfigSnapshot): void {
  if (!config.engineVersion.trim()) {
    throw new InvalidGameConfigError("A configuração do jogo precisa de uma engineVersion.");
  }
  assertValidBoardConfig(config.board);
  assertValidSorteZone(config.initialSorteZone, config.board);
  assertValidTemperatureBands(config.temperatureBands);
  if (
    !Number.isInteger(config.movementAllowancePerParticipation) ||
    config.movementAllowancePerParticipation < 0
  ) {
    throw new InvalidGameConfigError(
      "O saldo de movimentos por participação deve ser um inteiro maior ou igual a zero.",
    );
  }
  if (
    !Number.isInteger(config.finalLock.finalPhaseStartSequence) ||
    config.finalLock.finalPhaseStartSequence < 0
  ) {
    throw new InvalidGameConfigError(
      "O limiar de início da fase final deve ser um inteiro maior ou igual a zero.",
    );
  }
}
