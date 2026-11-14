import { describe, expect, it } from "vitest";
import {
  assertRoomTransition,
  canTransitionRoomStatus,
  InvalidRoomTransitionError,
  isTerminalRoomStatus,
} from "../room-state-machine.js";
import { assertValidRoomCapacity, InvalidRoomCapacityError } from "../room.entity.js";

describe("room state machine (CLAUDE.md #7)", () => {
  it("allows the documented forward path", () => {
    expect(canTransitionRoomStatus("DRAFT", "OPEN")).toBe(true);
    expect(canTransitionRoomStatus("OPEN", "ENTRY_LOCKED")).toBe(true);
    expect(canTransitionRoomStatus("ENTRY_LOCKED", "RUNNING")).toBe(true);
    expect(canTransitionRoomStatus("RUNNING", "FINAL_LOCK")).toBe(true);
    expect(canTransitionRoomStatus("FINAL_LOCK", "RESOLVING")).toBe(true);
    expect(canTransitionRoomStatus("RESOLVING", "COMPLETED")).toBe(true);
  });

  it("allows the V2 selection path ENTRY_LOCKED -> POSITION_SELECTION -> READY -> RUNNING (TASK-075)", () => {
    expect(canTransitionRoomStatus("ENTRY_LOCKED", "POSITION_SELECTION")).toBe(true);
    expect(canTransitionRoomStatus("POSITION_SELECTION", "READY")).toBe(true);
    expect(canTransitionRoomStatus("READY", "RUNNING")).toBe(true);
    expect(canTransitionRoomStatus("POSITION_SELECTION", "RUNNING")).toBe(false);
  });

  it("allows RUNNING -> RESOLVING for Engine V2 rooms (no final lock, BR-067)", () => {
    expect(canTransitionRoomStatus("RUNNING", "RESOLVING")).toBe(true);
  });

  it("allows cancellation from any non-terminal status (BR-045)", () => {
    const nonTerminal = [
      "DRAFT",
      "OPEN",
      "ENTRY_LOCKED",
      "POSITION_SELECTION",
      "READY",
      "RUNNING",
      "FINAL_LOCK",
      "RESOLVING",
    ] as const;
    for (const from of nonTerminal) {
      expect(canTransitionRoomStatus(from, "CANCELLED")).toBe(true);
    }
  });

  it("rejects transitions out of a terminal status", () => {
    expect(isTerminalRoomStatus("COMPLETED")).toBe(true);
    expect(isTerminalRoomStatus("CANCELLED")).toBe(true);
    expect(() => assertRoomTransition("COMPLETED", "OPEN")).toThrow(InvalidRoomTransitionError);
    expect(() => assertRoomTransition("CANCELLED", "OPEN")).toThrow(InvalidRoomTransitionError);
  });

  it("rejects skipping stages", () => {
    expect(canTransitionRoomStatus("DRAFT", "RUNNING")).toBe(false);
  });
});

describe("room capacity (BR-004/FR-019)", () => {
  it("accepts a positive integer", () => {
    expect(() => assertValidRoomCapacity(50)).not.toThrow();
  });

  it("rejects zero, negative or non-integer capacity", () => {
    expect(() => assertValidRoomCapacity(0)).toThrow(InvalidRoomCapacityError);
    expect(() => assertValidRoomCapacity(-1)).toThrow(InvalidRoomCapacityError);
    expect(() => assertValidRoomCapacity(2.5)).toThrow(InvalidRoomCapacityError);
  });
});
