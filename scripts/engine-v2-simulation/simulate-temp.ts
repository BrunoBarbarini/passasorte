/**
 * TASK-108 - Engine V2 simulation with TEMPERATURE-ONLY information (BR-090).
 * Players never see the Sorte position or the distance: only their level
 * (CONGELANDO..MUITO_QUENTE) at the start of each round. All numbers are SCENARIO
 * PARAMETERS of the experiment, not product rules.
 */
import {
  createGameEngineV2,
  entrySequenceOrder,
  ENTRY_SEQUENCE_ORDER_POLICY,
  INITIAL_TEMPERATURE_BANDS,
  participantTemperature,
} from "../../packages/domain/src/game/v2/index.js";
import type {
  GameStateV2,
  SorteDirection,
  TemperatureBands,
  TemperatureLevel,
} from "../../packages/domain/src/game/v2/index.js";
import { allocate, decide, rng } from "./simulate.js";
import type { PlayerSpec, Scenario, Strategy } from "./simulate.js";

const engine = createGameEngineV2();

export type BlindStrategy = Strategy | "PROBE" | "HOARD_BLIND" | "HOARD_SCOUT";
export interface BlindPlayer extends Omit<PlayerSpec, "strategy"> {
  readonly strategy: BlindStrategy;
}

export const LEVELS: readonly TemperatureLevel[] = [
  "CONGELANDO",
  "FRIO",
  "MORNO",
  "QUENTE",
  "MUITO_QUENTE",
];
const heat = (level: TemperatureLevel): number => LEVELS.indexOf(level);

interface Memory {
  dir: SorteDirection;
  lastHeat: number | null;
  lastSpent: number;
}

export interface BlindOutcome {
  readonly winnerId: string;
  /** levels[round-1][level] = how many players were at that level at the start of the round */
  readonly levels: number[][];
}

export function playBlindGame(
  players: readonly BlindPlayer[],
  scenario: Scenario,
  seed: number,
  bands: TemperatureBands = INITIAL_TEMPERATURE_BANDS,
): BlindOutcome {
  const rand = rng(seed);
  const asSpec = players.map((p) => ({ ...p, strategy: p.strategy as Strategy }));
  const { size, seats } = allocate(asSpec, scenario.layout, rand);
  let state: GameStateV2 = engine.initialize({
    config: { winningZoneSize: 1, maxMovementsPerRound: scenario.cap },
    participants: seats,
    randomnessCommitmentHash: "a".repeat(64),
    initialSortePosition: 1 + Math.floor(rand() * size),
  });
  const memory = new Map<string, Memory>(
    players.map((p) => [
      p.id,
      { dir: rand() < 0.5 ? "LEFT" : "RIGHT", lastHeat: null, lastSpent: 0 },
    ]),
  );
  const levels: number[][] = [];
  for (let round = 1; round <= scenario.rounds; round += 1) {
    const counts = [0, 0, 0, 0, 0];
    const submissions: {
      participantId: string;
      kind: SorteDirection;
      credits: number;
      submittedAt: string;
    }[] = [];
    const roundsLeft = scenario.rounds - round + 1;
    for (const p of players) {
      const seat = state.seats.find((s) => s.participantId === p.id);
      if (!seat) continue;
      const level = participantTemperature(state, p.id, bands).level;
      const h = heat(level);
      counts[h] = (counts[h] ?? 0) + 1;
      const mem = memory.get(p.id) as Memory;
      // learn from the last move: colder => the direction was wrong
      if (mem.lastSpent > 0 && mem.lastHeat !== null && h < mem.lastHeat)
        mem.dir = mem.dir === "LEFT" ? "RIGHT" : "LEFT";
      mem.lastHeat = h;
      mem.lastSpent = 0;
      let credits = 0;
      const balance = seat.movementBalance;
      if (p.strategy === "PROBE") {
        credits = level === "MUITO_QUENTE" ? 0 : Math.ceil(balance / roundsLeft);
      } else if (p.strategy === "HOARD_BLIND") {
        credits = roundsLeft === 1 ? balance : 0;
      } else if (p.strategy === "HOARD_SCOUT") {
        // spends 1 credit in the penultimate round to learn the direction, then everything
        credits = roundsLeft === 2 ? Math.min(1, balance) : roundsLeft === 1 ? balance : 0;
      } else if (p.strategy === "RANDOM") {
        credits = Math.min(balance, 1 + Math.floor(rand() * 3));
        mem.dir = rand() < 0.5 ? "LEFT" : "RIGHT";
      } else if (p.strategy === "AGGRESSIVE" || p.strategy === "HOARDER") {
        const d = decide(p as PlayerSpec, state, round, scenario.rounds, scenario.cap, rand);
        if (d)
          submissions.push({ participantId: p.id, ...d, submittedAt: "2026-11-13T10:00:30.000Z" });
        continue; // full-information reference players (see the Sorte position)
      }
      if (scenario.cap !== null) credits = Math.min(credits, scenario.cap);
      credits = Math.min(credits, balance);
      if (credits < 1) continue;
      mem.lastSpent = credits;
      submissions.push({
        participantId: p.id,
        kind: mem.dir,
        credits,
        submittedAt: "2026-11-13T10:00:30.000Z",
      });
    }
    levels.push(counts);
    state = engine.resolveRound(state, {
      roundId: `r${round}`,
      roundNumber: round,
      windowOpensAt: "2026-11-13T10:00:00.000Z",
      windowClosesAt: "2026-11-13T10:01:00.000Z",
      resolutionStartedAt: "2026-11-13T10:01:01.000Z",
      submissions,
      resolutionOrder: entrySequenceOrder(state),
      resolutionOrderPolicy: ENTRY_SEQUENCE_ORDER_POLICY,
    }).state;
  }
  const done = engine.complete(state, { serverTime: "2026-11-13T12:00:00.000Z" }).state;
  return { winnerId: engine.calculateWinners(done).winners[0]?.participantId as string, levels };
}
