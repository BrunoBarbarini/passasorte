import { describe, expect, it } from "vitest";
import {
  MovementAllocationExhaustedError,
  remainingMovementAllowance,
  spendMovement,
  type MovementAllocation,
} from "../movement-allocation.entity.js";
import {
  assertValidMovementSubmission,
  InvalidMovementSubmissionError,
} from "../movement-command-submission.js";
import type { Participation } from "../participation.entity.js";

describe("movement allocation (BR-020)", () => {
  it("spends one movement at a time", () => {
    const allocation: MovementAllocation = {
      participationId: "p1",
      totalAllowance: 2,
      usedCount: 0,
    };
    const afterOne = spendMovement(allocation);
    expect(remainingMovementAllowance(afterOne)).toBe(1);
    const afterTwo = spendMovement(afterOne);
    expect(remainingMovementAllowance(afterTwo)).toBe(0);
  });

  it("throws once exhausted, never going negative", () => {
    const exhausted: MovementAllocation = {
      participationId: "p1",
      totalAllowance: 1,
      usedCount: 1,
    };
    expect(() => spendMovement(exhausted)).toThrow(MovementAllocationExhaustedError);
  });
});

function buildParticipation(overrides: Partial<Participation> = {}): Participation {
  return {
    id: "p1",
    roomId: "room-1",
    userId: "user-1",
    packageId: "pkg-1",
    positions: [{ participationId: "p1", position: 5 }],
    status: "ACTIVE",
    movementAllowanceTotal: 3,
    movementAllowanceUsed: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("movement command submission (FR-037)", () => {
  it("accepts a command targeting the participation's own position", () => {
    const participation = buildParticipation();
    expect(() =>
      assertValidMovementSubmission(participation, {
        participationId: "p1",
        positionIndex: 0,
        direction: "RIGHT",
        sequence: 1,
      }),
    ).not.toThrow();
  });

  it("rejects a command targeting a position index the participation doesn't have", () => {
    const participation = buildParticipation();
    expect(() =>
      assertValidMovementSubmission(participation, {
        participationId: "p1",
        positionIndex: 1,
        direction: "RIGHT",
        sequence: 1,
      }),
    ).toThrow(InvalidMovementSubmissionError);
  });

  it("rejects a command when the participation isn't ACTIVE", () => {
    const participation = buildParticipation({ status: "LOCKED" });
    expect(() =>
      assertValidMovementSubmission(participation, {
        participationId: "p1",
        positionIndex: 0,
        direction: "LEFT",
        sequence: 1,
      }),
    ).toThrow(InvalidMovementSubmissionError);
  });
});
