/**
 * Board (CLAUDE.md BR-005/BR-006/BR-020/BR-021, FR-020/FR-021). Board
 * size and every other board dimension are CALLER-
 * SUPPLIED configuration - CLAUDE.md #58 forbids this module from
 * assuming/hard-coding any of them. Quadrants are disabled in the MVP
 * (CLAUDE.md DECISION-13) and no longer exist in this model.
 */

/** 0-indexed, room-scoped position on the board (BR-006). */
export type Position = number;

export interface BoardConfig {
  /** Total number of positions on the board (BR-005: configurable, never hard-coded). */
  readonly size: number;
}

export class InvalidBoardConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBoardConfigError";
  }
}

export function assertValidBoardConfig(config: BoardConfig): void {
  if (!Number.isInteger(config.size) || config.size <= 0) {
    throw new InvalidBoardConfigError("O tamanho do tabuleiro deve ser um inteiro positivo.");
  }
}

export function isPositionOnBoard(position: Position, config: BoardConfig): boolean {
  return Number.isInteger(position) && position >= 0 && position < config.size;
}
