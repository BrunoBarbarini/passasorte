/**
 * Campaign-level rules that sit above the pure engine (owner decision 2026-11-13).
 *
 * The engine still accepts `maxMovementsPerRound = null` (simulations, tests, replay of
 * older games), but a campaign cannot OPEN a room without a per-round limit: the
 * simulation (docs/SIMULACAO_ENGINE_V2.md) showed that, with no limit, saving every
 * movement for the last round is the best play (R-21). The VALUE of the limit is chosen
 * per campaign; no default exists (BR-068).
 */
import { GameEngineError } from "./errors.js";
import type { GameConfigV2 } from "./types.js";

export function assertRoundCapDefined(config: Pick<GameConfigV2, "maxMovementsPerRound">): void {
  const cap: unknown = config.maxMovementsPerRound;
  if (typeof cap !== "number" || !Number.isSafeInteger(cap) || cap < 1) {
    throw new GameEngineError(
      "ROUND_CAP_REQUIRED",
      "Toda campanha precisa de um limite de movimentos por rodada antes de abrir a sala.",
    );
  }
}
