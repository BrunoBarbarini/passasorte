import { describe, expect, it } from "vitest";
import {
  commitRandomSeed,
  deriveRandomUnitInterval,
  generateRandomSeed,
  RandomnessRevealMismatchError,
  verifyRevealedSeed,
} from "../randomness-commitment.js";

describe("randomness commitment (BR-030/BR-031)", () => {
  it("generates a hex seed", () => {
    const seed = generateRandomSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a seed against its own commitment", () => {
    const seed = generateRandomSeed();
    const commitment = commitRandomSeed(seed);
    expect(() => verifyRevealedSeed(seed, commitment)).not.toThrow();
  });

  it("rejects a seed that doesn't match the commitment (BR-031: no swapping after the fact)", () => {
    const commitment = commitRandomSeed(generateRandomSeed());
    expect(() => verifyRevealedSeed(generateRandomSeed(), commitment)).toThrow(
      RandomnessRevealMismatchError,
    );
  });

  it("commitment is deterministic for the same seed", () => {
    const seed = generateRandomSeed();
    expect(commitRandomSeed(seed)).toEqual(commitRandomSeed(seed));
  });
});

describe("deriveRandomUnitInterval", () => {
  it("is deterministic for the same seed and index", () => {
    const seed = generateRandomSeed();
    expect(deriveRandomUnitInterval(seed, 1)).toBe(deriveRandomUnitInterval(seed, 1));
  });

  it("differs across indices (overwhelmingly likely)", () => {
    const seed = generateRandomSeed();
    expect(deriveRandomUnitInterval(seed, 1)).not.toBe(deriveRandomUnitInterval(seed, 2));
  });

  it("stays within [0, 1)", () => {
    const seed = generateRandomSeed();
    for (let i = 0; i < 20; i += 1) {
      const value = deriveRandomUnitInterval(seed, i);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
