import { describe, expect, it } from "vitest";
import { assertRoundCapDefined, assertValidRoundSchedule } from "../index.js";
import { expectCode } from "./helpers.js";

describe("campaign rules: per-round cap is required (decision 2026-11-13)", () => {
  it("accepts a positive integer cap", () => {
    expect(() => assertRoundCapDefined({ maxMovementsPerRound: 3 })).not.toThrow();
    expect(() => assertRoundCapDefined({ maxMovementsPerRound: 1 })).not.toThrow();
  });

  it("rejects no limit, zero, negatives and non-integers", () => {
    for (const cap of [null, 0, -2, 1.5, Number.NaN]) {
      expectCode(() => assertRoundCapDefined({ maxMovementsPerRound: cap }), "ROUND_CAP_REQUIRED");
    }
  });
});

describe("assertValidRoundSchedule", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m));
  const entry = (roundNo: number, a: number, b: number) => ({
    roundNo,
    windowOpensAt: t(a),
    windowClosesAt: t(b),
  });

  it("accepts ordered, non-overlapping windows", () => {
    expect(() => assertValidRoundSchedule([entry(1, 0, 10), entry(2, 10, 20)])).not.toThrow();
  });
  it("rejects empty, misnumbered, empty-window and overlapping schedules", () => {
    expect(() => assertValidRoundSchedule([])).toThrow();
    expect(() => assertValidRoundSchedule([entry(2, 0, 10)])).toThrow();
    expect(() => assertValidRoundSchedule([entry(1, 10, 10)])).toThrow();
    expect(() => assertValidRoundSchedule([entry(1, 0, 10), entry(2, 5, 20)])).toThrow();
  });
});
