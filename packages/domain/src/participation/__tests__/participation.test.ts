import { describe, expect, it } from "vitest";
import {
  assertParticipationTransition,
  canTransitionParticipationStatus,
  InvalidParticipationTransitionError,
  isTerminalParticipationStatus,
} from "../participation-state-machine.js";
import { participationPositions, type Participation } from "../participation.entity.js";
import {
  assertValidParticipationPackage,
  InvalidParticipationPackageError,
} from "../participation-package.js";

describe("participation state machine (CLAUDE.md #7)", () => {
  it("follows the documented linear path", () => {
    expect(canTransitionParticipationStatus("CREATED", "RESERVED")).toBe(true);
    expect(canTransitionParticipationStatus("RESERVED", "AWAITING_REQUIREMENT")).toBe(true);
    expect(canTransitionParticipationStatus("AWAITING_REQUIREMENT", "CONFIRMED")).toBe(true);
    expect(canTransitionParticipationStatus("CONFIRMED", "ACTIVE")).toBe(true);
    expect(canTransitionParticipationStatus("ACTIVE", "LOCKED")).toBe(true);
    expect(canTransitionParticipationStatus("LOCKED", "RESOLVED")).toBe(true);
  });

  it("resolves to either WON or NOT_WON", () => {
    expect(canTransitionParticipationStatus("RESOLVED", "WON")).toBe(true);
    expect(canTransitionParticipationStatus("RESOLVED", "NOT_WON")).toBe(true);
  });

  it("both WON and NOT_WON complete", () => {
    expect(canTransitionParticipationStatus("WON", "COMPLETED")).toBe(true);
    expect(canTransitionParticipationStatus("NOT_WON", "COMPLETED")).toBe(true);
  });

  it("rejects skipping stages and moving out of COMPLETED", () => {
    expect(canTransitionParticipationStatus("CREATED", "ACTIVE")).toBe(false);
    expect(isTerminalParticipationStatus("COMPLETED")).toBe(true);
    expect(() => assertParticipationTransition("COMPLETED", "ACTIVE")).toThrow(
      InvalidParticipationTransitionError,
    );
  });
});

describe("participation entity", () => {
  it("participationPositions extracts the plain position numbers", () => {
    const participation: Participation = {
      id: "part-1",
      roomId: "room-1",
      userId: "user-1",
      packageId: "pkg-1",
      positions: [
        { participationId: "part-1", position: 3 },
        { participationId: "part-1", position: 7 },
      ],
      status: "ACTIVE",
      createdAt: new Date(),
    };
    expect(participationPositions(participation)).toEqual([3, 7]);
  });
});

describe("participation package (FR-029)", () => {
  it("accepts a valid package", () => {
    expect(() =>
      assertValidParticipationPackage({
        id: "pkg-1",
        positionCount: 2,
        movementAllowance: 3,
        eligibilityRules: [],
      }),
    ).not.toThrow();
  });

  it("rejects a non-positive position count", () => {
    expect(() =>
      assertValidParticipationPackage({
        id: "pkg-1",
        positionCount: 0,
        movementAllowance: 3,
        eligibilityRules: [],
      }),
    ).toThrow(InvalidParticipationPackageError);
  });

  it("rejects a negative movement allowance", () => {
    expect(() =>
      assertValidParticipationPackage({
        id: "pkg-1",
        positionCount: 1,
        movementAllowance: -1,
        eligibilityRules: [],
      }),
    ).toThrow(InvalidParticipationPackageError);
  });

  it("rejects a non-integer price (BR-035: integer minor units)", () => {
    expect(() =>
      assertValidParticipationPackage({
        id: "pkg-1",
        positionCount: 1,
        movementAllowance: 1,
        eligibilityRules: [],
        priceMinorUnits: 10.5,
      }),
    ).toThrow(InvalidParticipationPackageError);
  });
});
