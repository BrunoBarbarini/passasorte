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

export interface RoundScheduleEntry {
  readonly roundNo: number;
  readonly windowOpensAt: Date;
  readonly windowClosesAt: Date;
}

/**
 * The schedule is chosen by the operator per campaign (no default, BR-068). We only
 * validate its shape: at least one round, numbered 1..n, each window non-empty and
 * windows never overlapping (DECISION-16: collective window per round).
 */
export function assertValidRoundSchedule(schedule: readonly RoundScheduleEntry[]): void {
  if (schedule.length === 0) {
    throw new GameEngineError("INVALID_ROUND", "O cronograma precisa ter ao menos uma rodada.");
  }
  let previousClose: number | null = null;
  schedule.forEach((entry, index) => {
    const opens = entry.windowOpensAt.getTime();
    const closes = entry.windowClosesAt.getTime();
    if (entry.roundNo !== index + 1) {
      throw new GameEngineError(
        "INVALID_ROUND",
        "As rodadas devem ser numeradas em sequência a partir de 1.",
      );
    }
    if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) {
      throw new GameEngineError(
        "INVALID_ROUND",
        "Cada janela de rodada deve terminar depois de começar.",
      );
    }
    if (previousClose !== null && opens < previousClose) {
      throw new GameEngineError("INVALID_ROUND", "As janelas de rodada não podem se sobrepor.");
    }
    previousClose = closes;
  });
}
