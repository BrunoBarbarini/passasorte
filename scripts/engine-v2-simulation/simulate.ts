/**
 * Engine V2 simulation (A): fairness and the R-21 hoarding risk.
 * All numbers below are SCENARIO PARAMETERS of the experiment, not product rules.
 * Players only use information the product would show them: their own positions/balance
 * and the Sorte position at the start of each round (never other players' pending actions).
 */
import {
  createGameEngineV2,
  entrySequenceOrder,
  ENTRY_SEQUENCE_ORDER_POLICY,
} from "../../packages/domain/src/game/v2/index.js";
import type {
  AutoAction,
  GameStateV2,
  ParticipantSeatV2,
  SorteDirection,
} from "../../packages/domain/src/game/v2/index.js";

const engine = createGameEngineV2();

export type Strategy = "AGGRESSIVE" | "HOARDER" | "RANDOM" | "PASSIVE";

export interface PlayerSpec {
  readonly id: string;
  readonly positions: number;
  readonly movements: number;
  readonly strategy: Strategy;
  readonly auto: AutoAction;
}

export interface Scenario {
  readonly rounds: number;
  readonly cap: number | null;
  readonly layout: "SPREAD" | "CLUSTER" | "RANDOM";
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function allocate(players: readonly PlayerSpec[], layout: Scenario["layout"], rand: () => number) {
  const size = players.reduce((s, p) => s + p.positions, 0);
  const free = Array.from({ length: size }, (_, i) => i + 1);
  const seats: ParticipantSeatV2[] = [];
  players.forEach((p, index) => {
    let picked: number[];
    if (layout === "CLUSTER") {
      picked = free.splice(0, p.positions); // lowest free block, entry order
    } else if (layout === "SPREAD") {
      picked = [];
      const step = Math.max(1, Math.floor(free.length / p.positions));
      for (let k = 0; k < p.positions; k += 1) {
        const at = Math.min(free.length - 1, k * step);
        picked.push(free.splice(at, 1)[0] as number);
        // keep spacing relative to the shrinking free list
      }
    } else {
      picked = [];
      for (let k = 0; k < p.positions; k += 1) {
        picked.push(free.splice(Math.floor(rand() * free.length), 1)[0] as number);
      }
    }
    seats.push({
      participantId: p.id,
      entrySequence: index + 1,
      positions: picked.sort((a, b) => a - b),
      movementBalance: p.movements,
      autoAction: p.auto,
    });
  });
  return { size, seats };
}

function circ(a: number, b: number, n: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, n - d);
}

function decide(
  p: PlayerSpec,
  state: GameStateV2,
  round: number,
  rounds: number,
  cap: number | null,
  rand: () => number,
): { kind: SorteDirection; credits: number } | null {
  const seat = state.seats.find((s) => s.participantId === p.id);
  if (!seat || seat.movementBalance === 0) return null;
  const n = state.size;
  const s = state.sortePosition;
  const roundsLeft = rounds - round + 1;
  let budget: number;
  if (p.strategy === "PASSIVE") return null;
  if (p.strategy === "HOARDER") budget = roundsLeft === 1 ? seat.movementBalance : 0;
  else if (p.strategy === "RANDOM")
    budget = Math.min(seat.movementBalance, 1 + Math.floor(rand() * 3));
  else budget = Math.ceil(seat.movementBalance / roundsLeft);
  if (cap !== null) budget = Math.min(budget, cap);
  budget = Math.min(budget, seat.movementBalance);
  if (budget < 1) return null;
  if (p.strategy === "RANDOM") return { kind: rand() < 0.5 ? "LEFT" : "RIGHT", credits: budget };
  // nearest own position (circular) and the shorter direction to it
  let best = seat.positions[0] as number;
  for (const pos of seat.positions) if (circ(pos, s, n) < circ(best, s, n)) best = pos;
  const dist = circ(best, s, n);
  if (dist === 0) return null; // already on an own position: STAY costs a credit, do nothing
  const right = (best - s + n) % n;
  const kind: SorteDirection = right <= n - right ? "RIGHT" : "LEFT";
  return { kind, credits: Math.min(budget, dist) };
}

export interface GameOutcome {
  readonly winnerId: string;
  readonly size: number;
  readonly movesApplied: number;
}

export function playGame(
  players: readonly PlayerSpec[],
  scenario: Scenario,
  seed: number,
): GameOutcome {
  const rand = rng(seed);
  const { size, seats } = allocate(players, scenario.layout, rand);
  let state = engine.initialize({
    config: { winningZoneSize: 1, maxMovementsPerRound: scenario.cap },
    participants: seats,
    randomnessCommitmentHash: "a".repeat(64),
    initialSortePosition: 1 + Math.floor(rand() * size),
  });
  let moves = 0;
  const byId = new Map(players.map((p) => [p.id, p]));
  for (let round = 1; round <= scenario.rounds; round += 1) {
    const submissions = [] as {
      participantId: string;
      kind: SorteDirection;
      credits: number;
      submittedAt: string;
    }[];
    for (const p of players) {
      const d = decide(
        byId.get(p.id) as PlayerSpec,
        state,
        round,
        scenario.rounds,
        scenario.cap,
        rand,
      );
      if (d)
        submissions.push({ participantId: p.id, ...d, submittedAt: "2026-11-13T10:00:30.000Z" });
    }
    moves += submissions.length;
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
  const result = engine.calculateWinners(done);
  return { winnerId: result.winners[0]?.participantId as string, size, movesApplied: moves };
}
