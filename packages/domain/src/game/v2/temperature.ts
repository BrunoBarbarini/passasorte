/**
 * Participant temperature (T-10, DECISION-14, BR-078, BR-090).
 *
 * Distance = minimum CIRCULAR distance between the Sorte and any of the participant's
 * positions, expressed as a percentage of the bar size (so it means the same on any
 * board). The bar is circular, so the largest possible distance is 50% of the bar.
 * Five levels, the colder ones start where the hotter one ends.
 *
 * The band limits are CONFIGURATION (frozen in the room's config snapshot). The values in
 * `INITIAL_TEMPERATURE_BANDS` were approved on 2026-11-13 as a starting point to be
 * reviewed after the simulation and the pilot; they are not engine constants.
 *
 * BR-090: what a participant client may receive is ONLY `ParticipantTemperature`
 * (level + pt-BR label). The exact distance and the Sorte's position never leave the server.
 */
import { minCircularDistance } from "./circular-bar.js";
import { GameEngineError } from "./errors.js";
import type { GameStateV2 } from "./types.js";

export type TemperatureLevel = "CONGELANDO" | "FRIO" | "MORNO" | "QUENTE" | "MUITO_QUENTE";

/** Upper limit (inclusive) of each level as a % of the bar size. Anything above `frio` is CONGELANDO. */
export interface TemperatureBands {
  readonly muitoQuenteMaxPercent: number;
  readonly quenteMaxPercent: number;
  readonly mornoMaxPercent: number;
  readonly frioMaxPercent: number;
}

/** Approved 2026-11-13 as the initial configuration; revisable (see ADR-026 / CLAUDE.md T-10). */
export const INITIAL_TEMPERATURE_BANDS: TemperatureBands = {
  muitoQuenteMaxPercent: 2,
  quenteMaxPercent: 6,
  mornoMaxPercent: 15,
  frioMaxPercent: 30,
};

/** The only temperature data a participant client may receive (BR-090). */
export interface ParticipantTemperature {
  readonly level: TemperatureLevel;
  /** pt-BR text; temperature must never depend on colour alone (accessibility). */
  readonly label: string;
}

const LABELS: Readonly<Record<TemperatureLevel, string>> = {
  CONGELANDO: "Congelando",
  FRIO: "Frio",
  MORNO: "Morno",
  QUENTE: "Quente",
  MUITO_QUENTE: "Muito quente",
};

export function describeTemperaturePtBr(level: TemperatureLevel): string {
  return LABELS[level];
}

export function assertValidTemperatureBands(bands: TemperatureBands): void {
  const limits = [
    bands.muitoQuenteMaxPercent,
    bands.quenteMaxPercent,
    bands.mornoMaxPercent,
    bands.frioMaxPercent,
  ];
  const valid =
    limits.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    (limits[0] as number) > 0 &&
    limits.every((value, index) => index === 0 || value > (limits[index - 1] as number)) &&
    (limits[3] as number) < 50;
  if (!valid) {
    throw new GameEngineError(
      "INVALID_CONFIG",
      "Os limites de temperatura devem ser números crescentes, maiores que 0% e menores que 50% da barra.",
    );
  }
}

export function temperatureLevelFor(
  distance: number,
  size: number,
  bands: TemperatureBands,
): TemperatureLevel {
  assertValidTemperatureBands(bands);
  // distance / size * 100 <= max  <=>  distance * 100 <= max * size (no division)
  const scaled = distance * 100;
  if (scaled <= bands.muitoQuenteMaxPercent * size) return "MUITO_QUENTE";
  if (scaled <= bands.quenteMaxPercent * size) return "QUENTE";
  if (scaled <= bands.mornoMaxPercent * size) return "MORNO";
  if (scaled <= bands.frioMaxPercent * size) return "FRIO";
  return "CONGELANDO";
}

/** Server-side only: includes nothing a client may not see, but is still not sent as-is for other participants. */
export function participantTemperature(
  state: GameStateV2,
  participantId: string,
  bands: TemperatureBands,
): ParticipantTemperature {
  const seat = state.seats.find((candidate) => candidate.participantId === participantId);
  if (!seat) {
    throw new GameEngineError("UNKNOWN_PARTICIPANT", "Participante não pertence a esta partida.");
  }
  const distance = minCircularDistance(seat.positions, state.sortePosition, state.size);
  const level = temperatureLevelFor(distance, state.size, bands);
  return { level, label: describeTemperaturePtBr(level) };
}
