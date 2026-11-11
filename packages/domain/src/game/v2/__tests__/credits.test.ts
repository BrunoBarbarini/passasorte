import { describe, expect, it } from "vitest";
import { expectCode } from "./helpers.js";
import {
  assertWithinCreditLimit,
  GameEngineError,
  priceOfCredits,
  validateCreditSplit,
} from "../index.js";

describe("single credit unit (DECISION-02/05)", () => {
  it("accepts any split of the credits between positions and movements", () => {
    expect(validateCreditSplit({ positions: 8, movements: 2 }).total).toBe(10);
    expect(validateCreditSplit({ positions: 2, movements: 8 }).total).toBe(10);
  });

  it("rejects non-integer, negative or empty splits", () => {
    expect(() => validateCreditSplit({ positions: 1.5, movements: 1 })).toThrow(GameEngineError);
    expect(() => validateCreditSplit({ positions: -1, movements: 3 })).toThrow(GameEngineError);
    expect(() => validateCreditSplit({ positions: 0, movements: 0 })).toThrow(GameEngineError);
  });

  it("G-05: limit 20, holds 18, requests +5 -> rejected in full (never 23)", () => {
    expectCode(
      () =>
        assertWithinCreditLimit({ alreadyHeld: 18, requested: 5, maxCreditsPerParticipant: 20 }),
      "CREDIT_LIMIT_EXCEEDED",
    );
  });

  it("allows exactly up to the limit and returns the new total", () => {
    expect(
      assertWithinCreditLimit({ alreadyHeld: 18, requested: 2, maxCreditsPerParticipant: 20 }),
    ).toBe(20);
  });

  it("prices credits in integer minor units, never floats", () => {
    expect(priceOfCredits(10, 50)).toBe(500);
    expect(() => priceOfCredits(10, 0.5)).toThrow(GameEngineError);
  });
});
