import { describe, expect, it } from "vitest";
import {
  assertMovementAllowed,
  assertValidMovementAllowance,
  InvalidMovementAllowanceError,
  SIMULATION_ONLY_PLAYER_TRANSLATION_V1,
} from "../movement.js";

const BOARD = { size: 5 }; // positions 0..4

describe("movement allowance (BR-020)", () => {
  it("accepts a non-negative integer", () => {
    expect(() => assertValidMovementAllowance(0)).not.toThrow();
    expect(() => assertValidMovementAllowance(3)).not.toThrow();
  });

  it("rejects a negative or non-integer allowance", () => {
    expect(() => assertValidMovementAllowance(-1)).toThrow(InvalidMovementAllowanceError);
    expect(() => assertValidMovementAllowance(1.5)).toThrow(InvalidMovementAllowanceError);
  });

  it("assertMovementAllowed throws once the budget is exhausted", () => {
    expect(() => assertMovementAllowed(1)).not.toThrow();
    expect(() => assertMovementAllowed(0)).toThrow(InvalidMovementAllowanceError);
  });
});

describe("SIMULATION_ONLY_PLAYER_TRANSLATION_V1 (BR-023, simulation-only)", () => {
  it("moves one unit in the command's direction", () => {
    const next = SIMULATION_ONLY_PLAYER_TRANSLATION_V1.resolve({
      currentPosition: 2,
      command: { participationId: "p1", positionIndex: 0, direction: "RIGHT", sequence: 1 },
      board: BOARD,
    });
    expect(next).toBe(3);
  });

  it("clamps at the board's lower bound", () => {
    const next = SIMULATION_ONLY_PLAYER_TRANSLATION_V1.resolve({
      currentPosition: 0,
      command: { participationId: "p1", positionIndex: 0, direction: "LEFT", sequence: 1 },
      board: BOARD,
    });
    expect(next).toBe(0);
  });

  it("clamps at the board's upper bound", () => {
    const next = SIMULATION_ONLY_PLAYER_TRANSLATION_V1.resolve({
      currentPosition: 4,
      command: { participationId: "p1", positionIndex: 0, direction: "RIGHT", sequence: 1 },
      board: BOARD,
    });
    expect(next).toBe(4);
  });
});
