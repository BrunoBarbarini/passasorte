import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  circularDistance,
  createInitialSorteRecord,
  deriveInitialSortePosition,
  minCircularDistance,
  seededUnit,
} from "../index.js";
import { expectCode } from "./helpers.js";

const SEED = "c".repeat(64);
const COMMITMENT = createHash("sha256").update(SEED, "hex").digest("hex");

describe("initial Sorte (DECISION-15, BR-054)", () => {
  it("is always inside 1..N, including N = 1", () => {
    for (const size of [1, 2, 3, 16, 157, 420, 100_000]) {
      for (let i = 0; i < 50; i += 1) {
        const position = deriveInitialSortePosition(`${SEED}${i}`, size);
        expect(position).toBeGreaterThanOrEqual(1);
        expect(position).toBeLessThanOrEqual(size);
      }
    }
  });

  it("is deterministic and reproducible from the revealed seed", () => {
    expect(deriveInitialSortePosition(SEED, 157)).toBe(deriveInitialSortePosition(SEED, 157));
  });

  it("is roughly uniform over the bar", () => {
    const size = 10;
    const counts = new Array<number>(size).fill(0);
    for (let i = 0; i < 5000; i += 1) {
      const index = deriveInitialSortePosition(`seed-${i}`, size) - 1;
      counts[index] = (counts[index] ?? 0) + 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(400);
      expect(count).toBeLessThan(600);
    }
  });

  it("uses independent streams per purpose", () => {
    expect(seededUnit(SEED, "initial-sorte", 0)).not.toBe(seededUnit(SEED, "auto-allocation", 0));
  });

  it("records the fields required by DECISION-15 and proves the commitment", () => {
    const record = createInitialSorteRecord({
      gameId: "game-1",
      boardSize: 157,
      sealedSeedHex: SEED,
      randomnessCommitmentHash: COMMITMENT,
      generatedAt: "2026-11-11T20:00:00.000Z",
    });
    expect(record).toEqual({
      gameId: "game-1",
      boardSize: 157,
      engineVersion: "2.0.0",
      randomnessCommitmentHash: COMMITMENT,
      initialLuckPosition: deriveInitialSortePosition(SEED, 157),
      generatedAt: "2026-11-11T20:00:00.000Z",
    });
  });

  it("refuses a seed that does not match the commitment published before N was known", () => {
    expectCode(
      () =>
        createInitialSorteRecord({
          gameId: "game-1",
          boardSize: 157,
          sealedSeedHex: "d".repeat(64),
          randomnessCommitmentHash: COMMITMENT,
          generatedAt: "2026-11-11T20:00:00.000Z",
        }),
      "COMMITMENT_MISMATCH",
    );
  });
});

describe("circular distance for temperature (DECISION-14, BR-014)", () => {
  it("treats 55 and 5 on a bar of 60 as close, as the owner's example requires", () => {
    expect(circularDistance(55, 5, 60)).toBe(10);
    expect(circularDistance(5, 55, 60)).toBe(10);
  });

  it("uses the minimum over every position the participant owns", () => {
    expect(minCircularDistance([20, 55, 30], 5, 60)).toBe(10);
    expect(minCircularDistance([5], 5, 60)).toBe(0);
  });

  it("never exceeds half of the bar", () => {
    for (let a = 1; a <= 11; a += 1) {
      for (let b = 1; b <= 11; b += 1) {
        expect(circularDistance(a, b, 11)).toBeLessThanOrEqual(5);
      }
    }
  });
});
