import { describe, expect, it } from "vitest";
import {
  FinalMovementPlanAlreadyLockedError,
  isInFinalPhase,
  lockFinalMovementPlan,
  SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1,
} from "../final-lock.js";

describe("final phase detection (BR-027)", () => {
  it("is false before the configured threshold", () => {
    expect(isInFinalPhase(4, { finalPhaseStartSequence: 5 })).toBe(false);
  });

  it("is true at/after the configured threshold", () => {
    expect(isInFinalPhase(5, { finalPhaseStartSequence: 5 })).toBe(true);
    expect(isInFinalPhase(9, { finalPhaseStartSequence: 5 })).toBe(true);
  });
});

describe("final movement plan lock (BR-028: immutable once locked)", () => {
  it("locks a plan when none exists yet", () => {
    const plan = lockFinalMovementPlan(undefined, "p1", [], 5);
    expect(plan.immutable).toBe(true);
    expect(plan.lockedAtSequence).toBe(5);
  });

  it("refuses to re-lock an already-locked plan", () => {
    const existing = lockFinalMovementPlan(undefined, "p1", [], 5);
    expect(() => lockFinalMovementPlan(existing, "p1", [], 6)).toThrow(
      FinalMovementPlanAlreadyLockedError,
    );
  });
});

describe("SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1 (BR-029, simulation-only)", () => {
  it("locks whatever was last submitted as the effective plan", () => {
    const lastKnownCommands = [
      { participationId: "p1", positionIndex: 0, direction: "LEFT" as const, sequence: 3 },
    ];
    const plan = SIMULATION_ONLY_KEEP_LAST_SUBMITTED_V1.resolveMissingPlan({
      participationId: "p1",
      lastKnownCommands,
      atSequence: 5,
    });
    expect(plan.commands).toEqual(lastKnownCommands);
    expect(plan.immutable).toBe(true);
  });
});
