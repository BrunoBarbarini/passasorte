/**
 * Board (CLAUDE.md BR-005/BR-006/BR-020/BR-021, FR-020/FR-021). Board
 * size, quadrant count and every other board dimension are CALLER-
 * SUPPLIED configuration - CLAUDE.md #58 forbids this module from
 * assuming/hard-coding any of them.
 */

/** 0-indexed, room-scoped position on the board (BR-006). */
export type Position = number;

export interface BoardQuadrant {
  readonly id: string;
  readonly start: Position;
  readonly end: Position; // inclusive
}

export interface BoardConfig {
  /** Total number of positions on the board (BR-005: configurable, never hard-coded). */
  readonly size: number;
  /** Optional logical regions/quadrants (BR-021/FR-021) - configurable, may be omitted. */
  readonly quadrants?: readonly BoardQuadrant[];
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
  for (const quadrant of config.quadrants ?? []) {
    if (
      !Number.isInteger(quadrant.start) ||
      !Number.isInteger(quadrant.end) ||
      quadrant.start < 0 ||
      quadrant.end >= config.size ||
      quadrant.start > quadrant.end
    ) {
      throw new InvalidBoardConfigError(
        `O quadrante "${quadrant.id}" tem limites inválidos para um tabuleiro de tamanho ${config.size}.`,
      );
    }
  }
}

export function isPositionOnBoard(position: Position, config: BoardConfig): boolean {
  return Number.isInteger(position) && position >= 0 && position < config.size;
}
