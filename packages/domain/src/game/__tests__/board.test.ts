import { describe, expect, it } from "vitest";
import { assertValidBoardConfig, InvalidBoardConfigError, isPositionOnBoard } from "../board.js";

describe("board config", () => {
  it("accepts a positive integer size with no quadrants", () => {
    expect(() => assertValidBoardConfig({ size: 20 })).not.toThrow();
  });

  it("rejects a non-positive size", () => {
    expect(() => assertValidBoardConfig({ size: 0 })).toThrow(InvalidBoardConfigError);
    expect(() => assertValidBoardConfig({ size: -5 })).toThrow(InvalidBoardConfigError);
  });

  it("rejects a non-integer size", () => {
    expect(() => assertValidBoardConfig({ size: 10.5 })).toThrow(InvalidBoardConfigError);
  });

  it("accepts quadrants fully inside the board", () => {
    expect(() =>
      assertValidBoardConfig({
        size: 10,
        quadrants: [
          { id: "A", start: 0, end: 4 },
          { id: "B", start: 5, end: 9 },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects a quadrant that overflows the board", () => {
    expect(() =>
      assertValidBoardConfig({ size: 10, quadrants: [{ id: "A", start: 0, end: 10 }] }),
    ).toThrow(InvalidBoardConfigError);
  });

  it("isPositionOnBoard respects bounds", () => {
    expect(isPositionOnBoard(0, { size: 10 })).toBe(true);
    expect(isPositionOnBoard(9, { size: 10 })).toBe(true);
    expect(isPositionOnBoard(10, { size: 10 })).toBe(false);
    expect(isPositionOnBoard(-1, { size: 10 })).toBe(false);
  });
});
