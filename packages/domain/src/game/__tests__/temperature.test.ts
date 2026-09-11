import { describe, expect, it } from "vitest";
import {
  assertValidTemperatureBands,
  classifyTemperature,
  distanceToSorteZone,
  InvalidTemperatureBandsError,
  minDistanceToSorteZone,
  normalizeDistance,
} from "../temperature.js";

const BOARD = { size: 21 }; // positions 0..20, max distance 20
const ZONE = { start: 10, end: 12 };
const BANDS = [
  { name: "QUENTE", maxNormalizedDistance: 0.1 },
  { name: "MORNO", maxNormalizedDistance: 0.5 },
  { name: "FRIO", maxNormalizedDistance: 1 },
];

describe("distance to Sorte zone", () => {
  it("is zero inside the zone", () => {
    expect(distanceToSorteZone(10, ZONE)).toBe(0);
    expect(distanceToSorteZone(11, ZONE)).toBe(0);
    expect(distanceToSorteZone(12, ZONE)).toBe(0);
  });

  it("is the gap to the nearer edge outside the zone", () => {
    expect(distanceToSorteZone(8, ZONE)).toBe(2);
    expect(distanceToSorteZone(15, ZONE)).toBe(3);
  });

  it("minDistanceToSorteZone takes the minimum across positions (BR-014)", () => {
    expect(minDistanceToSorteZone([0, 11, 20], ZONE)).toBe(0);
    expect(minDistanceToSorteZone([0, 5], ZONE)).toBe(5);
  });

  it("minDistanceToSorteZone rejects an empty position list", () => {
    expect(() => minDistanceToSorteZone([], ZONE)).toThrow(RangeError);
  });
});

describe("normalizeDistance", () => {
  it("normalizes against the board's max distance", () => {
    expect(normalizeDistance(0, BOARD)).toBe(0);
    expect(normalizeDistance(20, BOARD)).toBe(1);
    expect(normalizeDistance(10, BOARD)).toBeCloseTo(0.5);
  });
});

describe("temperature bands", () => {
  it("accepts ascending bands covering up to 1", () => {
    expect(() => assertValidTemperatureBands(BANDS)).not.toThrow();
  });

  it("rejects an empty band list", () => {
    expect(() => assertValidTemperatureBands([])).toThrow(InvalidTemperatureBandsError);
  });

  it("rejects bands that don't reach 1", () => {
    expect(() =>
      assertValidTemperatureBands([{ name: "SO", maxNormalizedDistance: 0.5 }]),
    ).toThrow(InvalidTemperatureBandsError);
  });

  it("rejects non-ascending bands", () => {
    expect(() =>
      assertValidTemperatureBands([
        { name: "A", maxNormalizedDistance: 0.5 },
        { name: "B", maxNormalizedDistance: 0.3 },
      ]),
    ).toThrow(InvalidTemperatureBandsError);
  });

  it("classifies into the first band whose ceiling covers the distance", () => {
    expect(classifyTemperature(0, BANDS).name).toBe("QUENTE");
    expect(classifyTemperature(0.3, BANDS).name).toBe("MORNO");
    expect(classifyTemperature(1, BANDS).name).toBe("FRIO");
  });
});
