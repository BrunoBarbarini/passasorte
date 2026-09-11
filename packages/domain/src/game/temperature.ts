/**
 * Temperature (BR-014..BR-017/FR-034/FR-045/FR-046): personalized,
 * private, derived from normalized distance to the Sorte zone, with
 * CONFIGURABLE bands (BR-016) - no band thresholds are hard-coded here.
 */
import type { BoardConfig, Position } from "./board.js";
import type { SorteZone } from "./sorte.js";

/** Distance from `position` to the Sorte zone (0 when inside the zone). */
export function distanceToSorteZone(position: Position, zone: SorteZone): number {
  if (position < zone.start) return zone.start - position;
  if (position > zone.end) return position - zone.end;
  return 0;
}

/**
 * BR-014: "Player distance is minimum distance between active
 * participant positions and Sorte range" - a participant may hold
 * multiple positions (BR-007), so this takes the minimum across all of
 * them.
 */
export function minDistanceToSorteZone(positions: readonly Position[], zone: SorteZone): number {
  if (positions.length === 0) {
    throw new RangeError("Não é possível calcular distância sem posições ativas.");
  }
  return Math.min(...positions.map((p) => distanceToSorteZone(p, zone)));
}

/** Distance normalized to [0, 1] against the maximum possible distance on this board. */
export function normalizeDistance(distance: number, board: BoardConfig): number {
  const maxDistance = board.size - 1;
  if (maxDistance <= 0) return 0;
  return Math.min(Math.max(distance / maxDistance, 0), 1);
}

/** A configurable temperature band (BR-016), e.g. { name: "QUENTE", maxNormalizedDistance: 0.1 }. */
export interface TemperatureBand {
  readonly name: string;
  /** Inclusive upper bound of normalized distance [0, 1] this band covers. */
  readonly maxNormalizedDistance: number;
}

export class InvalidTemperatureBandsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTemperatureBandsError";
  }
}

/** Bands must be strictly ascending and cover the full [0, 1] range with no gaps. */
export function assertValidTemperatureBands(bands: readonly TemperatureBand[]): void {
  if (bands.length === 0) {
    throw new InvalidTemperatureBandsError(
      "É necessário configurar ao menos uma faixa de temperatura.",
    );
  }
  let previous = -1;
  for (const band of bands) {
    if (band.maxNormalizedDistance <= previous || band.maxNormalizedDistance > 1) {
      throw new InvalidTemperatureBandsError(
        `As faixas de temperatura devem ser crescentes e estar no intervalo (${previous}, 1] - "${band.name}" é inválida.`,
      );
    }
    previous = band.maxNormalizedDistance;
  }
  if (previous < 1) {
    throw new InvalidTemperatureBandsError(
      "As faixas de temperatura devem cobrir até a distância normalizada 1.",
    );
  }
}

/** Classifies a normalized distance into the first configured band whose ceiling covers it. */
export function classifyTemperature(
  normalizedDistance: number,
  bands: readonly TemperatureBand[],
): TemperatureBand {
  const band = bands.find((b) => normalizedDistance <= b.maxNormalizedDistance);
  if (!band) {
    throw new InvalidTemperatureBandsError(
      `Nenhuma faixa de temperatura cobre a distância normalizada ${normalizedDistance}.`,
    );
  }
  return band;
}
