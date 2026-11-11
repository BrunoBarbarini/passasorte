import { describe, expect, it } from "vitest";
import type { AutoAction, GameStateV2, ReplayStep, SorteDirection } from "../index.js";
import { engine, initInput, lcg, T0 } from "./helpers.js";

const AUTOS: readonly AutoAction[] = ["LEFT", "RIGHT", "STAY", "NONE"];
const DIRS: readonly SorteDirection[] = ["LEFT", "RIGHT", "STAY"];

describe("GameEngine V2 - invariants under random play (CLAUDE.md 8.3)", () => {
  it("holds for 300 seeded random games", () => {
    const next = lcg(777);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;

    for (let game = 0; game < 300; game += 1) {
      const participants = 1 + Math.floor(next() * 6);
      const specs = Array.from({ length: participants }, (_, i) => ({
        id: `P${i}`,
        count: 1 + Math.floor(next() * 8),
        balance: Math.floor(next() * 13),
        auto: pick(AUTOS),
      }));
      const cap = next() < 0.4 ? null : 1 + Math.floor(next() * 4);
      const size = specs.reduce((sum, s) => sum + s.count, 0);
      const init = initInput(specs, 1 + Math.floor(next() * size), cap);
      let state: GameStateV2 = engine.initialize(init);
      const initialTotal = specs.reduce((sum, s) => sum + s.balance, 0);
      const positions = state.seats.map((s) => s.positions);
      const steps: ReplayStep[] = [];
      let consumed = 0;
      let turn = 0;

      for (let round = 1; round <= 5; round += 1) {
        for (const seat of state.seats) {
          turn += 1;
          const current = state.seats.find((s) => s.participantId === seat.participantId)!;
          const base = {
            participantId: seat.participantId,
            turnId: `t${game}-${turn}`,
            round,
            turnIndexInRound: seat.turnOrder,
            serverTime: T0,
          };
          const present = next() < 0.6 && current.movementBalance > 0;
          if (present) {
            const kind = pick(DIRS);
            const limit = Math.min(current.movementBalance, cap ?? current.movementBalance);
            const credits = kind === "STAY" ? 1 : 1 + Math.floor(next() * limit);
            const command = { ...base, kind, credits, executionType: "MANUAL" as const };
            const result = engine.applyMovement(state, command);
            consumed += result.transition.creditsConsumed;
            steps.push({ type: "MOVEMENT", command });
            state = result.state;
          } else {
            const plan = engine.planAbsentTurn(state, seat.participantId);
            if (plan.action === "AUTOMATIC") {
              const command = {
                ...base,
                kind: plan.kind,
                credits: plan.credits,
                executionType: "AUTOMATIC" as const,
              };
              const result = engine.applyMovement(state, command);
              consumed += 1;
              steps.push({ type: "MOVEMENT", command });
              state = result.state;
            } else {
              const result = engine.skipTurn(state, base);
              expect(result.transition.creditsConsumed).toBe(0);
              expect(result.state.sortePosition).toBe(state.sortePosition);
              steps.push({ type: "SKIP", input: base });
              state = result.state;
            }
          }
          expect(state.sortePosition).toBeGreaterThanOrEqual(1);
          expect(state.sortePosition).toBeLessThanOrEqual(size);
          expect(state.seats.every((s) => s.movementBalance >= 0)).toBe(true);
          expect(state.seats.map((s) => s.positions)).toEqual(positions);
          const remaining = state.seats.reduce((sum, s) => sum + s.movementBalance, 0);
          expect(consumed + remaining).toBe(initialTotal); // conservation
        }
      }

      const completed = engine.complete(state, { serverTime: T0 });
      steps.push({ type: "COMPLETE", input: { serverTime: T0 } });
      const expiredTotal = completed.transition.expired.reduce((sum, e) => sum + e.movements, 0);
      expect(consumed + expiredTotal).toBe(initialTotal);

      const result = engine.calculateWinners(completed.state);
      const owner = completed.state.seats.find(
        (s) => s.participantId === result.winners[0]?.participantId,
      );
      expect(result.winners).toHaveLength(1);
      expect(owner?.positions).toContain(completed.state.sortePosition);

      const replayed = engine.replay({ init, steps });
      expect(replayed.state).toEqual(completed.state);
      expect(replayed.result).toEqual(result);
    }
  });
});
