import { describe, expect, it } from "vitest";
import { circularDistance, displaceSorte, GameEngineError } from "../index.js";
import { lcg } from "./helpers.js";

describe("circular bar (DECISION-01)", () => {
  it("G-01: N=200, Sorte at 198, RIGHT x1..x5 -> 199, 200, 1, 2, 3", () => {
    expect([1, 2, 3, 4, 5].map((k) => displaceSorte(198, "RIGHT", k, 200))).toEqual([
      199, 200, 1, 2, 3,
    ]);
  });

  it("G-02: 200 + RIGHT -> 1", () => {
    expect(displaceSorte(200, "RIGHT", 1, 200)).toBe(1);
  });

  it("G-03: 1 + LEFT -> 200", () => {
    expect(displaceSorte(1, "LEFT", 1, 200)).toBe(200);
  });

  it("G-04: 198 + RIGHT x4 -> 2", () => {
    expect(displaceSorte(198, "RIGHT", 4, 200)).toBe(2);
  });

  it("STAY never displaces", () => {
    expect(displaceSorte(37, "STAY", 1, 200)).toBe(37);
  });

  it("is circular in both directions and wraps several laps", () => {
    expect(displaceSorte(3, "LEFT", 5, 10)).toBe(8);
    expect(displaceSorte(3, "RIGHT", 25, 10)).toBe(8);
  });

  it("works on a bar of size 1", () => {
    expect(displaceSorte(1, "RIGHT", 7, 1)).toBe(1);
    expect(displaceSorte(1, "LEFT", 7, 1)).toBe(1);
  });

  it("rejects invalid positions, sizes and credits", () => {
    expect(() => displaceSorte(0, "RIGHT", 1, 10)).toThrow(GameEngineError);
    expect(() => displaceSorte(11, "RIGHT", 1, 10)).toThrow(GameEngineError);
    expect(() => displaceSorte(1, "RIGHT", 1, 0)).toThrow(GameEngineError);
    expect(() => displaceSorte(1, "RIGHT", -1, 10)).toThrow(GameEngineError);
    expect(() => displaceSorte(1, "RIGHT", 1.5, 10)).toThrow(GameEngineError);
  });

  it("G-11: circular distance N=200, 199 vs 2 is 3 (not 197)", () => {
    expect(circularDistance(199, 2, 200)).toBe(3);
    expect(circularDistance(2, 199, 200)).toBe(3);
    expect(circularDistance(5, 5, 200)).toBe(0);
    expect(circularDistance(1, 101, 200)).toBe(100);
  });

  it("property: RIGHT x k then LEFT x k returns to the start; N credits is a full lap", () => {
    const next = lcg(20261111);
    for (let i = 0; i < 500; i += 1) {
      const size = 1 + Math.floor(next() * 400);
      const position = 1 + Math.floor(next() * size);
      const k = Math.floor(next() * 1000);
      const there = displaceSorte(position, "RIGHT", k, size);
      expect(there).toBeGreaterThanOrEqual(1);
      expect(there).toBeLessThanOrEqual(size);
      expect(displaceSorte(there, "LEFT", k, size)).toBe(position);
      expect(displaceSorte(position, "RIGHT", size, size)).toBe(position);
      expect(displaceSorte(position, "LEFT", size, size)).toBe(position);
    }
  });
});
