/**
 * Sorte zone (BR-012/BR-013): a configurable-width range on the board.
 * How the zone MOVES round to round is a separate, explicitly TBD
 * concern - see sorte-progression.ts and ADR-018/CLAUDE.md #58 ("Sorte
 * algorithm" must never be invented as a shipped rule). This module only
 * knows the zone's *shape*.
 */
import type { BoardConfig, Position } from "./board.js";

export interface SorteZone {
  readonly start: Position;
  readonly end: Position; // inclusive
}

export class InvalidSorteZoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSorteZoneError";
  }
}

export function assertValidSorteZone(zone: SorteZone, board: BoardConfig): void {
  if (
    !Number.isInteger(zone.start) ||
    !Number.isInteger(zone.end) ||
    zone.start < 0 ||
    zone.end >= board.size ||
    zone.start > zone.end
  ) {
    throw new InvalidSorteZoneError(
      `A zona da Sorte [${zone.start}, ${zone.end}] é inválida para um tabuleiro de tamanho ${board.size}.`,
    );
  }
}

/** BR-013: zone width is configurable - this just measures it, never assumes a value. */
export function sorteZoneWidth(zone: SorteZone): number {
  return zone.end - zone.start + 1;
}

export function isPositionInSorteZone(position: Position, zone: SorteZone): boolean {
  return position >= zone.start && position <= zone.end;
}
