import { createGameEngineV2 } from "../index.js";
import type {
  AutoAction,
  GameInitInput,
  GameStateV2,
  MovementCommandV2,
  ParticipantSeatV2,
  SorteDirection,
} from "../index.js";

export const engine = createGameEngineV2();
export const T0 = "2026-11-11T20:00:00.000Z";
export const COMMITMENT = "a".repeat(64);

/** Deterministic pseudo-random generator for property-style tests (no Math.random). */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export interface SeatSpec {
  readonly id: string;
  readonly count: number;
  readonly balance: number;
  readonly auto?: AutoAction;
}

/** Contiguous ownership 1..N in confirmation order (any ownership pattern is valid for the engine). */
export function seatsOf(specs: readonly SeatSpec[]): ParticipantSeatV2[] {
  let next = 1;
  return specs.map((spec, index) => ({
    participantId: spec.id,
    entrySequence: index + 1,
    positions: Array.from({ length: spec.count }, () => next++),
    movementBalance: spec.balance,
    autoAction: spec.auto ?? "NONE",
  }));
}

export function initInput(
  specs: readonly SeatSpec[],
  initialSortePosition: number,
  maxMovementsPerRound: number | null = null,
): GameInitInput {
  return {
    config: { winningZoneSize: 1, maxMovementsPerRound },
    participants: seatsOf(specs),
    randomnessCommitmentHash: COMMITMENT,
    initialSortePosition,
  };
}

export function startGame(
  specs: readonly SeatSpec[],
  initialSortePosition: number,
  maxMovementsPerRound: number | null = null,
): GameStateV2 {
  return engine.initialize(initInput(specs, initialSortePosition, maxMovementsPerRound));
}

let turnCounter = 0;
export function manual(
  participantId: string,
  kind: SorteDirection,
  credits: number,
  actionId: string = `action-${(turnCounter += 1)}`,
): MovementCommandV2 {
  return {
    participantId,
    actionId,
    round: 1,
    resolutionSequence: 0,
    serverTime: T0,
    kind,
    credits,
    executionType: "MANUAL",
  };
}

/** Two participants owning 100 positions each (N = 200). */
export const BAR_200: readonly SeatSpec[] = [
  { id: "A", count: 100, balance: 10 },
  { id: "B", count: 100, balance: 10 },
];

import { expect } from "vitest";
import { GameEngineError } from "../index.js";
import type { GameEngineErrorCode } from "../index.js";

/** Asserts that `fn` throws a GameEngineError with the given stable code. */
export function expectCode(fn: () => unknown, code: GameEngineErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(GameEngineError);
  expect((caught as GameEngineError).code).toBe(code);
}
