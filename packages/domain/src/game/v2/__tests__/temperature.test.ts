import { describe, expect, it } from "vitest";
import {
  INITIAL_TEMPERATURE_BANDS,
  assertValidTemperatureBands,
  describeTemperaturePtBr,
  participantTemperature,
  temperatureLevelFor,
} from "../index.js";
import type { TemperatureBands } from "../index.js";
import { expectCode, startGame } from "./helpers.js";

const BANDS = INITIAL_TEMPERATURE_BANDS;

describe("temperature levels (T-10, BR-078)", () => {
  it("uses inclusive upper limits in % of the bar", () => {
    // bar of 100: 1 position = 1%
    expect(temperatureLevelFor(0, 100, BANDS)).toBe("MUITO_QUENTE");
    expect(temperatureLevelFor(2, 100, BANDS)).toBe("MUITO_QUENTE");
    expect(temperatureLevelFor(3, 100, BANDS)).toBe("QUENTE");
    expect(temperatureLevelFor(6, 100, BANDS)).toBe("QUENTE");
    expect(temperatureLevelFor(7, 100, BANDS)).toBe("MORNO");
    expect(temperatureLevelFor(15, 100, BANDS)).toBe("MORNO");
    expect(temperatureLevelFor(16, 100, BANDS)).toBe("FRIO");
    expect(temperatureLevelFor(30, 100, BANDS)).toBe("FRIO");
    expect(temperatureLevelFor(31, 100, BANDS)).toBe("CONGELANDO");
    expect(temperatureLevelFor(50, 100, BANDS)).toBe("CONGELANDO");
  });

  it("means the same on any bar size (percentage, not positions)", () => {
    expect(temperatureLevelFor(20, 1000, BANDS)).toBe("MUITO_QUENTE");
    expect(temperatureLevelFor(21, 1000, BANDS)).toBe("QUENTE");
    expect(temperatureLevelFor(2, 100, BANDS)).toBe("MUITO_QUENTE");
  });

  it("is monotonic: a larger distance is never hotter", () => {
    const order = ["MUITO_QUENTE", "QUENTE", "MORNO", "FRIO", "CONGELANDO"];
    for (const size of [10, 37, 100, 250]) {
      let previous = 0;
      for (let distance = 0; distance <= size / 2; distance += 1) {
        const rank = order.indexOf(temperatureLevelFor(distance, size, BANDS));
        expect(rank).toBeGreaterThanOrEqual(previous);
        previous = rank;
      }
    }
  });

  it("rejects invalid band configurations", () => {
    const bad: TemperatureBands[] = [
      { ...BANDS, muitoQuenteMaxPercent: 0 },
      { ...BANDS, quenteMaxPercent: 2 },
      { ...BANDS, mornoMaxPercent: 5 },
      { ...BANDS, frioMaxPercent: 50 },
      { ...BANDS, frioMaxPercent: Number.NaN },
    ];
    for (const bands of bad) expectCode(() => assertValidTemperatureBands(bands), "INVALID_CONFIG");
    expect(() => assertValidTemperatureBands(BANDS)).not.toThrow();
  });

  it("has a pt-BR text for every level (accessibility)", () => {
    expect(describeTemperaturePtBr("MUITO_QUENTE")).toBe("Muito quente");
    expect(describeTemperaturePtBr("CONGELANDO")).toBe("Congelando");
  });
});

describe("participant temperature (BR-090, DECISION-14)", () => {
  const specs = [
    { id: "A", count: 50, balance: 5 },
    { id: "B", count: 50, balance: 5 },
  ];

  it("uses the circular distance to the nearest own position", () => {
    // positions: A owns 1..50, B owns 51..100; Sorte at 100 is on B and 1 is 1 step away for A (circular)
    const state = startGame(specs, 100);
    expect(participantTemperature(state, "B", BANDS).level).toBe("MUITO_QUENTE");
    expect(participantTemperature(state, "A", BANDS)).toEqual({
      level: "MUITO_QUENTE",
      label: "Muito quente",
    });
  });

  it("exposes ONLY level and label, never the distance or the Sorte position", () => {
    const state = startGame(specs, 30);
    const projection = participantTemperature(state, "B", BANDS);
    expect(Object.keys(projection).sort()).toEqual(["label", "level"]);
    expect(JSON.stringify(projection)).not.toMatch(/\b30\b/);
  });

  it("rejects an unknown participant", () => {
    expectCode(
      () => participantTemperature(startGame(specs, 10), "Z", BANDS),
      "UNKNOWN_PARTICIPANT",
    );
  });
});
