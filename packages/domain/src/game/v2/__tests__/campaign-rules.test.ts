import { describe, expect, it } from "vitest";
import { assertRoundCapDefined } from "../index.js";
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
